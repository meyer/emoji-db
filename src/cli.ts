// https://docs.microsoft.com/en-us/typography/opentype/spec/otff
import path from 'path';
import fs from 'fs';
import { BinaryParser } from './BinaryParser';
import { nameIds, NameIdKey } from './constants';

const ROOT_DIR = path.resolve(__dirname, '..');
const FONTS_DIR = path.join(ROOT_DIR, 'fonts');
const EMOJI_IMG_DIR = path.join(ROOT_DIR, 'images');

process.on('uncaughtException', err => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', err => {
  console.error('Uncaught rejection:', err);
  process.exit(1);
});

interface TTFFont {
  offset: number;
  sfntVersion: number;
  numTables: number;
  searchRange: number;
  entrySelector: number;
  rangeShift: number;
  tableOffsetsByTag: Record<string, number>;
  nameTable: Partial<Record<NameIdKey, string>>;
  headTable: HeadTable;
  maxpTable: MaxpTable;
}

interface HeadTable {
  version: number;
  fontRevision: number;
  checksumAdjustment: number;
  magicNumber: string;
  flags: number;
  unitsPerEm: number;
  created: Date;
  modified: Date;
}

interface MaxpTable {
  version: number;
  numGlyphs: number;
}

interface Strike {
  offset: number;
  ppem: number;
  ppi: number;
}

interface SequentialMapGroups {
  startCharCode: number;
  endCharCode: number;
  startGlyphId: number;
}

(async argv => {
  if (argv.length !== 1) {
    throw new Error('one arg pls');
  }

  const manifest: Record<string, any> = {};

  const fontPath = path.join(FONTS_DIR, argv[0]);
  const fh = await fs.promises.open(fontPath, 'r');
  const bp = new BinaryParser(fh);

  try {
    const header = await bp.ascii(4);

    const isTtcf = header === 'ttcf';

    if (!isTtcf) {
      throw new Error('File header is not ttcf: ' + header);
    }

    console.log('we have a TTC');

    const ttcVersion = await bp.uint32();

    if (ttcVersion !== 0x00020000) {
      throw new Error('Only TTC version 2.0 is supported for now');
    }

    const numFonts = await bp.uint32();

    const offsets: number[] = [];

    for (let i = 0; i < numFonts; i++) {
      offsets[i] = await bp.uint32();
    }

    await bp.uint32(); // dsigTag
    await bp.uint32(); // dsigLength
    await bp.uint32(); // dsigOffset

    const fonts: TTFFont[] = [];

    console.log('Found %o font%s', numFonts, numFonts === 1 ? '' : 's');

    for (const fontOffset of offsets) {
      bp.position = fontOffset;

      const sfntVersion = await bp.uint32();
      const numTables = await bp.uint16();
      const searchRange = await bp.uint16();
      const entrySelector = await bp.uint16();
      const rangeShift = await bp.uint16();

      if (sfntVersion !== 0x00010000) {
        throw new Error('sfntVersion !== 0x00010000 (got ' + sfntVersion + ')');
      }

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
        .reduce<Record<string, number>>((p, [key, value]) => ({ [key]: value, ...p }), {});

      // https://docs.microsoft.com/en-us/typography/opentype/spec/maxp
      bp.position = tableOffsetsByTag.maxp;

      const maxpVersion = await bp.uint32();
      const numGlyphs = await bp.uint16();

      if (maxpVersion !== 0x00010000) {
        throw new Error('Only maxp table version 1 is supported');
      }

      const maxpTable: MaxpTable = {
        version: maxpVersion,
        numGlyphs,
      };

      // https://docs.microsoft.com/en-us/typography/opentype/spec/head
      bp.position = tableOffsetsByTag.head;

      const headVersion = await bp.fixed(32, 16);
      const fontRevision = await bp.fixed(32, 16);
      const checksumAdjustment = await bp.uint32();
      const magicNumber = await bp.uint32();
      const flags = await bp.uint16();
      const unitsPerEm = await bp.uint16();
      const created = await bp.longdatetime();
      const modified = await bp.longdatetime();

      if (magicNumber !== 0x5f0f3cf5) {
        throw new Error('Magic number is not 0x5F0F3CF5');
      }

      const headTable: HeadTable = {
        version: headVersion,
        fontRevision,
        checksumAdjustment,
        magicNumber: magicNumber.toString(16),
        flags,
        unitsPerEm,
        created,
        modified,
      };

      // https://docs.microsoft.com/en-us/typography/opentype/spec/name
      bp.position = tableOffsetsByTag.name;

      const nameFormat = await bp.uint16();
      const recordCount = await bp.uint16();
      const stringOffset = await bp.uint16();
      const storageAreaOffset = tableOffsetsByTag.name + stringOffset;

      if (nameFormat !== 0) {
        throw new Error('Only name table format 0 is supported');
      }

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

        let key = nameIds[nameId];

        if (!key) {
          continue;
        }

        nameTable[key] = name;
      }

      fonts.push({
        offset: fontOffset,
        sfntVersion,
        numTables,
        searchRange,
        entrySelector,
        rangeShift,
        tableOffsetsByTag,
        nameTable,
        headTable,
        maxpTable,
      });
    }

    const emojiFont = fonts.find(f => f.nameTable.postScriptName === 'AppleColorEmoji');

    if (!emojiFont) {
      throw new Error('Could not find a font named Apple Color Emoji');
    }

    console.log('font:', emojiFont);

    manifest.name = emojiFont.nameTable.fontFamilyName;
    manifest.version = emojiFont.nameTable.versionString;
    manifest.created = emojiFont.headTable.created;
    manifest.modified = emojiFont.headTable.modified;

    const {
      tableOffsetsByTag,
      maxpTable: { numGlyphs },
    } = emojiFont;

    bp.position = tableOffsetsByTag.cmap;

    const cmapVersion = await bp.uint16();
    const numTables = await bp.uint16();

    if (cmapVersion !== 0) {
      throw new Error('Only cmap table version 0 is supported');
    }

    if (numTables > 1) {
      throw new Error('Only one cmap table is supported');
    }

    const encodingRecord = {
      platformId: await bp.uint16(),
      encodingId: await bp.uint16(),
      offset: await bp.offset32(),
    };

    bp.position = tableOffsetsByTag.cmap + encodingRecord.offset;

    const cmapFormat = await bp.uint16();

    if (cmapFormat !== 12) {
      throw new Error('Only cmap format 12 is supported');
    }

    await bp.uint16(); // length
    await bp.uint32(); // numVarSelectorRecords
    await bp.uint32(); // language
    const numGroups = await bp.uint32();

    const sequentialMapGroups: SequentialMapGroups[] = [];
    for (let idx2 = 0; idx2 < numGroups; idx2++) {
      const startCharCode = await bp.uint32();
      const endCharCode = await bp.uint32();
      const startGlyphId = await bp.uint32();
      sequentialMapGroups.push({
        startCharCode,
        endCharCode,
        startGlyphId,
      });
    }

    manifest.sequentialMapGroups = sequentialMapGroups;

    // https://docs.microsoft.com/en-us/typography/opentype/spec/sbix
    bp.position = tableOffsetsByTag.sbix;

    const sbixVersion = await bp.uint16();
    await bp.uint16(); // flags
    const numStrikes = await bp.uint32();

    if (sbixVersion !== 1) {
      throw new Error('Only sbix table version 1 is supported for now');
    }

    const strikes: Strike[] = [];
    for (let idx = 0; idx < numStrikes; idx++) {
      const offset = await bp.offset32();
      const position = tableOffsetsByTag.sbix + offset;
      const thing = await bp.int32(position);
      const ppem = thing >> 16;
      const ppi = (thing << 16) >> 16;
      strikes.push({ offset, ppem, ppi });
    }

    // strike with the greatest PPEM value
    const strikeOffset = strikes.sort((a, b) => a.ppem - b.ppem).pop()!;

    bp.position = tableOffsetsByTag.post;

    const postVersion = await bp.int32();

    if (postVersion !== 0x00020000) {
      throw new Error('post table version must be 0x00020000');
    }

    await bp.uint32(); // italicAngle
    await bp.fword(); // underlinePosition
    await bp.fword(); // underlineThickness
    await bp.uint32(); // isFixedPitch
    await bp.uint32(); // minMemType42
    await bp.uint32(); // maxMemType42
    await bp.uint32(); // minMemType1
    await bp.uint32(); // maxMemType

    const postNumGlyphs = await bp.uint16();

    if (postNumGlyphs !== numGlyphs) {
      console.error(postNumGlyphs, '!==', numGlyphs);
      throw new Error('postNumGlyphs !== numGlyphs');
    }

    const glyphNameIndex: Array<number | null> = [];
    let maxGlyph: number = 0;
    for (let idx = 0; idx < numGlyphs; idx++) {
      const glyph = await bp.uint16();
      if (glyph >= 0 && glyph <= 257) {
        // standard glyph names, not very interesting
        glyphNameIndex.push(null);
      } else if (glyph >= 258 && glyph <= 65535) {
        const glyphId = glyph - 258;
        glyphNameIndex.push(glyph - 258);
        if (maxGlyph < glyphId) {
          maxGlyph = glyphId;
        }
      } else {
        throw new Error(`Glyph at index ${idx} was out of bounds`);
      }
    }

    const names: string[] = [];
    for (let idx = 0; idx < maxGlyph; idx++) {
      const len = await bp.int8();
      const text = await bp.ascii(len);
      names.push(text);
    }

    // add 4 bytes to skip PPEM and PPI
    bp.position = tableOffsetsByTag.sbix + strikeOffset.offset + 4;

    let offsetCache = await bp.offset32();

    for (let idx = 0; idx < numGlyphs; idx++) {
      // cache the old offset
      const currentGlyphOffset = offsetCache;
      // fetch the next offset
      const nextGlyphOffset = await bp.offset32();
      offsetCache = nextGlyphOffset;

      const size = nextGlyphOffset - currentGlyphOffset;

      if (size === 0) {
        // no bitmap data
        continue;
      }

      const glyphIdx = glyphNameIndex[idx];

      if (glyphIdx == null) {
        console.log(idx, 'is missing a glyph index', size);
        continue;
      }

      const name = names[glyphIdx];

      if (!name) {
        console.log('No name for glyph %o (size: %o)', idx, size);
        continue;
      }

      const offset = tableOffsetsByTag.sbix + strikeOffset.offset + currentGlyphOffset;

      const graphicType = await bp.tag(offset + 4);
      const data = await bp.readBytes(size, offset + 8);

      if (graphicType !== 'png ') {
        throw new Error('Not a PNG!');
      }

      await fs.promises.writeFile(path.join(EMOJI_IMG_DIR, name + '.png'), data);
    }

    console.log('manifest:', manifest);

    await fs.promises.writeFile(path.join(EMOJI_IMG_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await fh.close();
  }
})(process.argv.slice(2));
