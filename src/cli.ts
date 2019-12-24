// https://docs.microsoft.com/en-us/typography/opentype/spec/otff
import path from 'path';
import fs from 'fs';
import { BinaryParser } from './BinaryParser';
import {
  ttcfHeader,
  cffTtfHeader,
  ttfHeader,
  FONTS_DIR,
  // EMOJI_IMG_DIR,
  // DATA_DIR,
} from './constants';
import { toCodepoints } from './utils/toCodepoints';
import { numToHex } from './utils/numToHex';
import { toEmojiKey } from './utils/toEmojiKey';
import { normaliseBasename } from './utils/normaliseBasename';
import { invariant } from './utils/invariant';
import { getTtfFromOffset, TTFFont } from './getTtfFromOffset';
import emojiData from 'emojilib/emojis.json';
import annotationData from '../data/annotations.json';

type EmojiData = typeof emojiData;
type EmojiDatum = EmojiData[keyof EmojiData] & { name: string };

const nameMapping: Record<string, string | undefined> = {
  '+1': 'plus_one',
  '-1': 'minus_one',
};

const emojiDataByKey = Object.entries(emojiData).reduce<Record<string, EmojiDatum>>((p, [name, obj]) => {
  const codepoints = toCodepoints(obj.char);
  const key = toEmojiKey(codepoints);
  invariant(!p.hasOwnProperty(key), 'key `%s` is already present in emoji data', key);
  return { ...p, [key]: { ...obj, name: nameMapping[name] || name } };
}, {});

interface Strike {
  offset: number;
  ppem: number;
  ppi: number;
}

interface SequentialMapGroup {
  startCharCode: string;
  endCharCode: string;
  startGlyphId: number;
}

interface EmojiDbEntry {
  name: string;
  emojilib_name: string | null;
  codepoints: number[];
  unicode_category: string | null;
  unicode_subcategory: string | null;
  keywords: string[];
  emoji: string;
  image: string;
  fitz: Record<number, string>;
}

export type EmojiDb = Record<string, EmojiDbEntry>;

(async argv => {
  invariant(argv.length === 1, 'one arg pls');

  const manifest: Record<string, any> = {};

  const fontPath = path.join(FONTS_DIR, argv[0]);
  const fh = await fs.promises.open(fontPath, 'r');
  const bp = new BinaryParser(fh);

  let emojiFont: TTFFont | undefined;

  try {
    const header = await bp.uint32();

    // OpenType with CFF data
    invariant(header !== cffTtfHeader, 'Unsupported TTF header:', numToHex(header));

    // OpenType with TrueType outlines
    if (header === ttfHeader) {
      console.log('we have a TTF');
      emojiFont = await getTtfFromOffset(fh, 0);
    }

    // TrueType collection
    else if (header === ttcfHeader) {
      console.log('we have a TTC');

      const ttcVersion = await bp.uint32();

      invariant(ttcVersion === 0x00020000, 'Only TTC version 2.0 is supported');

      const numFonts = await bp.uint32();
      console.log('Found %o font%s', numFonts, numFonts === 1 ? '' : 's');

      const offsets: number[] = [];

      for (let i = 0; i < numFonts; i++) {
        offsets[i] = await bp.uint32();
      }

      await bp.uint32(); // dsigTag
      await bp.uint32(); // dsigLength
      await bp.uint32(); // dsigOffset

      const fonts = await Promise.all(offsets.map(offset => getTtfFromOffset(fh, offset)));

      emojiFont = fonts.find(f => f.nameTable.postScriptName === 'AppleColorEmoji');
    }

    // Unsupported
    else {
      invariant(false, 'File header is not ttcf:', numToHex(header));
    }

    invariant(emojiFont, 'Could not find a font named Apple Color Emoji');

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

    invariant(cmapVersion === 0, 'Only cmap table version 0 is supported');
    invariant(numTables === 1, 'Only one cmap table is supported');

    const encodingRecord = {
      platformId: await bp.uint16(),
      encodingId: await bp.uint16(),
      offset: await bp.offset32(),
    };

    // https://docs.microsoft.com/en-us/typography/opentype/spec/cmap
    bp.position = tableOffsetsByTag.cmap + encodingRecord.offset;

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

    // https://docs.microsoft.com/en-us/typography/opentype/spec/sbix
    bp.position = tableOffsetsByTag.sbix;

    const sbixVersion = await bp.uint16();
    await bp.uint16(); // flags
    const numStrikes = await bp.uint32();

    invariant(sbixVersion === 1, 'Only sbix table version 1 is supported for now');

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

    // add 4 bytes to skip PPEM and PPI
    bp.position = tableOffsetsByTag.sbix + strikeOffset.offset + 4;

    let offsetCache = await bp.offset32();

    // await fs.promises.mkdir(EMOJI_IMG_DIR);

    const emojiByKey: Record<string, any> = {};

    for (let idx = 0; idx < numGlyphs; idx++) {
      // cache the old offset
      const currentGlyphOffset = offsetCache;
      // fetch the next offset
      const nextGlyphOffset = await bp.offset32();
      offsetCache = nextGlyphOffset;

      const size = nextGlyphOffset - currentGlyphOffset;

      const glyphIdx = glyphNameIndex[idx];

      if (glyphIdx == null) {
        continue;
      }

      if (size === 0) {
        // no bitmap data
        continue;
      }

      const name = names[glyphIdx];

      if (!name) {
        console.log('No name for glyph %o (size: %o)', idx, size);
        continue;
      }

      const basename = normaliseBasename(name);
      const emojilibData = emojiDataByKey.hasOwnProperty(basename) ? emojiDataByKey[basename] : null;
      const emojilibName = emojilibData?.name ?? null;
      if (!emojilibData) {
        console.log('No emojilib data for %s (%s)', basename, name);
      }

      const annotationData1 = annotationData.hasOwnProperty(basename)
        ? annotationData[basename as keyof typeof annotationData]
        : null;

      if (!annotationData1) {
        console.log('No annotation data for %s (%s)', basename, name);
      }

      const offset = tableOffsetsByTag.sbix + strikeOffset.offset + currentGlyphOffset;

      const graphicType = await bp.tag(offset + 4);
      /*const data =*/ await bp.readBytes(size, offset + 8);

      invariant(graphicType === 'png ', 'Not a PNG!');

      // const absPath = path.join(EMOJI_IMG_DIR, name + '.png');

      // await fs.promises.writeFile(absPath, data, {
      //   // write should fail if the file already exists
      //   flag: 'wx',
      // });

      emojiByKey[name] = {
        emojilibName,
        keywords: [],
        char: null,
        fitzpatrick_scale: null,
        category: null,
        name,
        ...emojilibData,
      };
    }

    manifest.emojiByKey = emojiByKey;

    // await fs.promises.writeFile(path.join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await fh.close();
  }
})(process.argv.slice(2)).catch(err => {
  console.error(err);
  process.exit(1);
});
