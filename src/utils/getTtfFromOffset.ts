import type fs from 'fs';
import { BinaryParser } from '../BinaryParser.js';
import { type HeadTable, type MaxpTable, TrueTypeFont } from '../TrueTypeFont.js';
import { CFF_TTF_HEADER, type NameIdKey, TTF_HEADER, nameIds } from '../constants.js';
import { invariant } from './invariant.js';
import { numToHex } from './numToHex.js';

export const getTtfFromOffset = async (fh: fs.promises.FileHandle, position: number): Promise<TrueTypeFont> => {
  const bp = new BinaryParser(fh, position);

  const sfntVersion = await bp.uint32();

  invariant(sfntVersion !== CFF_TTF_HEADER, 'sfntVersion is valid but not supported');
  invariant(sfntVersion === TTF_HEADER, 'sfntVersion !== %s (got %s)', numToHex(TTF_HEADER), sfntVersion);

  const numTables = await bp.uint16();
  await bp.uint16(); // searchRange
  await bp.uint16(); // entrySelector
  await bp.uint16(); // rangeShift

  const unsortedTableOffsetsByTag: Record<string, number> = {};

  for (let idx = 0, len = numTables; idx < len; idx++) {
    const tag = await bp.tag();
    await bp.uint32(); // checksum
    const tableOffset = await bp.uint32();
    await bp.uint32(); // length
    unsortedTableOffsetsByTag[tag] = tableOffset;
  }

  const tableOffsetsByTag: Record<string, number> = Object.entries(unsortedTableOffsetsByTag)
    .sort((a, b) => b[1] - a[1])
    .reduce<Record<string, number>>((p, [key, value]) => {
      p[key] = value;
      return p;
    }, {});

  // https://docs.microsoft.com/en-us/typography/opentype/spec/maxp
  invariant(tableOffsetsByTag.maxp, 'No maxp');
  bp.position = tableOffsetsByTag.maxp;

  const maxpVersion = await bp.uint32();
  const numGlyphs = await bp.uint16();

  invariant(maxpVersion === 0x00010000, 'Only maxp table version 1 is supported');

  const maxpTable: MaxpTable = {
    version: maxpVersion,
    numGlyphs,
  };

  // https://docs.microsoft.com/en-us/typography/opentype/spec/head
  invariant(tableOffsetsByTag.head, 'No head');
  bp.position = tableOffsetsByTag.head;

  const headVersion = await bp.fixed(32, 16);
  const fontRevision = await bp.fixed(32, 16);
  const checksumAdjustment = await bp.uint32();
  const magicNumber = await bp.uint32();
  const flags = await bp.uint16();
  const unitsPerEm = await bp.uint16();
  const created = await bp.longdatetime();
  const modified = await bp.longdatetime();
  await bp.int16(); // xMin
  await bp.int16(); // yMin
  await bp.int16(); // xMax
  await bp.int16(); // yMax
  await bp.uint16(); // macStyle
  await bp.int16(); // lowestRecPPEM
  await bp.int16(); // fontDirectionHint
  const indexToLocFormat = await bp.int16();
  const glyphDataFormat = await bp.int16();

  invariant(magicNumber === 0x5f0f3cf5, 'Magic number is not 0x5F0F3CF5');

  const headTable: HeadTable = {
    version: headVersion,
    fontRevision,
    checksumAdjustment,
    flags,
    unitsPerEm,
    created,
    modified,
    indexToLocFormat: indexToLocFormat === 0 ? 'short' : 'long',
    glyphDataFormat,
  };

  // https://docs.microsoft.com/en-us/typography/opentype/spec/name
  invariant(tableOffsetsByTag.name, 'No name');
  bp.position = tableOffsetsByTag.name;

  const nameFormat = await bp.uint16();
  const recordCount = await bp.uint16();
  const stringOffset = await bp.uint16();
  const storageAreaOffset = tableOffsetsByTag.name + stringOffset;

  invariant(nameFormat === 0, 'Only name table format 0 is supported');

  const nameTable: Partial<Record<NameIdKey, string>> = {};

  for (let idx = 0; idx < recordCount; idx++) {
    await bp.uint16(); // platformId
    await bp.uint16(); // encodingId
    const languageId = await bp.uint16();
    // skip non-English languages
    if (languageId !== 0) {
      continue;
    }
    const nameId = await bp.uint16();
    const length = await bp.uint16();
    const offset = await bp.uint16();
    const nameBuf = await bp.readBytes(length, storageAreaOffset + offset);
    const name = nameBuf.toString('latin1');

    const key = nameIds[nameId];

    if (!key) {
      continue;
    }

    nameTable[key] = name;
  }

  return new TrueTypeFont(fh, maxpTable, headTable, nameTable, numTables, tableOffsetsByTag);
};
