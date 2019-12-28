import { NameIdKey } from './constants';
import { invariant } from './utils/invariant';
import { BinaryParser } from './BinaryParser';
import fs from 'fs';

export interface HeadTable {
  version: number;
  fontRevision: number;
  checksumAdjustment: number;
  flags: number;
  unitsPerEm: number;
  created: Date;
  modified: Date;
  indexToLocFormat: 'short' | 'long';
  glyphDataFormat: number;
}

export interface MaxpTable {
  version: number;
  numGlyphs: number;
}

export interface CmapTable {
  sequentialMapGroups: SequentialMapGroup[];
}

export interface SbixTable {
  strikes: Strike[];
  strikeOffset: Strike;
}

export interface PostTable {
  names: string[];
  glyphNameIndex: Array<number | null>;
}

export interface SequentialMapGroup {
  startCharCode: string;
  endCharCode: string;
  startGlyphId: number;
}

export interface Strike {
  offset: number;
  ppem: number;
  ppi: number;
}

export class TrueTypeFont {
  constructor(
    public readonly fh: fs.promises.FileHandle,
    public readonly maxp: MaxpTable,
    public readonly head: HeadTable,
    public readonly name: Partial<Record<NameIdKey, string>>,
    public readonly numTables: number,
    public readonly tableOffsetsByTag: Record<string, number | undefined>
  ) {}

  /** https://docs.microsoft.com/en-us/typography/opentype/spec/cmap */
  public async getCmapTable(): Promise<CmapTable> {
    invariant(this.tableOffsetsByTag.cmap != null, 'Missing cmap table offset');
    const bp = new BinaryParser(this.fh, this.tableOffsetsByTag.cmap);

    const cmapVersion = await bp.uint16();
    const numTables = await bp.uint16();

    invariant(cmapVersion === 0, 'Only cmap table version 0 is supported');
    invariant(numTables === 1, 'Only one cmap table is supported');

    const encodingRecord = {
      platformId: await bp.uint16(),
      encodingId: await bp.uint16(),
      offset: await bp.offset32(),
    };

    bp.position = this.tableOffsetsByTag.cmap + encodingRecord.offset;

    const cmapFormat = await bp.uint16();

    invariant(cmapFormat === 12, 'Only cmap format 12 is supported');

    await bp.uint16(); // reserved
    await bp.uint32(); // length
    await bp.uint32(); // language
    const numGroups = await bp.uint32();

    const sequentialMapGroups: SequentialMapGroup[] = [];
    for (let idx = 0; idx < numGroups; idx++) {
      const startCharCode = await bp.uint32();
      const endCharCode = await bp.uint32();
      const startGlyphId = await bp.uint32();
      sequentialMapGroups.push({
        startCharCode: startCharCode.toString(16),
        endCharCode: endCharCode.toString(16),
        startGlyphId,
      });
    }

    return { sequentialMapGroups };
  }

  /** https://docs.microsoft.com/en-us/typography/opentype/spec/post */
  public async getPostTable(): Promise<PostTable> {
    invariant(this.tableOffsetsByTag.post != null, 'Missing post table offset');
    const bp = new BinaryParser(this.fh, this.tableOffsetsByTag.post);

    const postVersion = await bp.int32();

    invariant(postVersion === 0x00020000, 'post table version must be 0x00020000');

    await bp.uint32(); // italicAngle
    await bp.fword(); // underlinePosition
    await bp.fword(); // underlineThickness
    await bp.uint32(); // isFixedPitch
    await bp.uint32(); // minMemType42
    await bp.uint32(); // maxMemType42
    await bp.uint32(); // minMemType1
    await bp.uint32(); // maxMemType

    const postNumGlyphs = await bp.uint16();

    const numGlyphs = this.maxp.numGlyphs;

    invariant(postNumGlyphs === numGlyphs, 'postNumGlyphs diff: %o !== %o', postNumGlyphs, numGlyphs);

    const glyphNameIndex: Array<number | null> = [];
    let maxGlyph: number = 0;
    for (let idx = 0; idx < numGlyphs; idx++) {
      const glyph = await bp.uint16();
      if (glyph >= 0 && glyph <= 257) {
        // standard glyph names, not very interesting
        glyphNameIndex.push(null);
      } else if (glyph >= 258 && glyph <= 65535) {
        const glyphId = glyph - 258;
        glyphNameIndex.push(glyphId);
        if (maxGlyph < glyphId) {
          maxGlyph = glyphId;
        }
      } else {
        invariant(false, 'Glyph at index %o was out of bounds', idx);
      }
    }

    const names: string[] = [];
    for (let idx = 0; idx < maxGlyph; idx++) {
      const len = await bp.int8();
      const text = await bp.ascii(len);
      names.push(text);
    }

    return { names, glyphNameIndex };
  }

  /** https://docs.microsoft.com/en-us/typography/opentype/spec/sbix */
  public async *getEmojiIterator() {
    invariant(this.tableOffsetsByTag.sbix != null, 'Missing sbix table offset');
    const bp = new BinaryParser(this.fh, this.tableOffsetsByTag.sbix);

    const sbixVersion = await bp.uint16();
    await bp.uint16(); // flags
    const numStrikes = await bp.uint32();

    invariant(sbixVersion === 1, 'Only sbix table version 1 is supported for now');

    const strikes: Strike[] = [];
    for (let idx = 0; idx < numStrikes; idx++) {
      const offset = await bp.offset32();
      const position = this.tableOffsetsByTag.sbix + offset;
      const thing = await bp.int32(position);
      const ppem = thing >> 16;
      const ppi = (thing << 16) >> 16;
      strikes.push({ offset, ppem, ppi });
    }

    // strike with the greatest PPEM value
    const strikeOffset = strikes.sort((a, b) => a.ppem - b.ppem).pop()!;

    const post = await this.getPostTable();

    // add 4 bytes to skip PPEM and PPI
    bp.position = this.tableOffsetsByTag.sbix + strikeOffset.offset + 4;

    let offsetCache = await bp.offset32();

    for (let idx = 0; idx < this.maxp.numGlyphs - 1; idx++) {
      // cache the old offset
      const currentGlyphOffset = offsetCache;
      // fetch the next offset
      const nextGlyphOffset = await bp.offset32();
      offsetCache = nextGlyphOffset;

      const size = nextGlyphOffset - currentGlyphOffset;

      const glyphIdx = post.glyphNameIndex[idx];

      if (glyphIdx == null) {
        continue;
      }

      if (size === 0) {
        // no bitmap data
        continue;
      }

      const name = post.names[glyphIdx];
      invariant(name, 'No name for glyph %o (size: %o)', idx, size);

      const offset = this.tableOffsetsByTag.sbix + strikeOffset.offset + currentGlyphOffset;

      const graphicType = await bp.tag(offset + 4);
      invariant(graphicType === 'png ', 'Not a PNG!');

      const data = await bp.readBytes(size - 8, offset + 8);

      yield { data, name };
    }
  }
}
