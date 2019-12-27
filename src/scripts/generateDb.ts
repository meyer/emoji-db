// https://docs.microsoft.com/en-us/typography/opentype/spec/otff
import path from 'path';
import fs from 'fs';
import {
  fitzpatrickModifiers,
  FONTS_DIR,
  MAN_CODEPOINT,
  PERSON_CODEPOINT,
  ROOT_DIR,
  WOMAN_CODEPOINT,
} from '../constants';
import { invariant } from '../utils/invariant';
import { getFontByName } from '../utils/getFontByName';
import stringify from 'json-stable-stringify';
import { sortKeyStringifyOptions } from '../utils/sortKeyStringifyOptions';
import annotationData from '../../data/annotations.json';
import derivedAnnotationData from '../../data/annotationsDerived.json';
import emojilibData from '../../data/emojilib.json';
import sequenceData from '../../data/emoji-sequences.json';
import variationSequenceData from '../../data/emoji-variation-sequences.json';
import zwjSequenceData from '../../data/emoji-zwj-sequences.json';
import { toEmojiSortKey } from '../utils/toEmojiSortKey';
import { toEmojiKey } from '../utils/toEmojiKey';

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
  sortKey: string;
}

type EmojiDb = Record<string, EmojiDbEntry>;

const holdingHandRegex = /^u(1F(?:46[89]|9D1))_u1F91D_u(1F(?:46[89]|9D1))\.([0-6])([0-6])$/;

(async argv => {
  invariant(argv.length === 1, 'one arg pls');
  const fontPath = path.join(FONTS_DIR, argv[0]);
  const ttf = await getFontByName(fontPath, 'AppleColorEmoji');

  const emojiDb: EmojiDb = {};
  const absPath = path.join(ROOT_DIR, 'emoji-db.json');

  try {
    for await (const emoji of ttf.getEmojiIterator()) {
      let codepoints: number[] | null = null;
      let char: string | null = null;
      let name: string | null = null;
      const keywords: string[] = [];

      const basename = emoji.name.replace(/(?:\.0$|\.0(\.[MW])$)/, '$1');
      let annotation =
        basename in derivedAnnotationData
          ? derivedAnnotationData[basename as keyof typeof derivedAnnotationData]
          : basename in annotationData
          ? annotationData[basename as keyof typeof annotationData]
          : null;

      if (!annotation) {
        const match = emoji.name.match(holdingHandRegex);
        // some fitzpatrick variants for holding hands emoji are missing
        invariant(match, '`%s` does not match holdingHandRegex', emoji.name);

        const left = parseInt(match[1], 16);
        const right = parseInt(match[2], 16);
        const fitz1Int = parseInt(match[3], 10);
        const fitz2Int = parseInt(match[4], 10);
        const fitz1 = fitzpatrickModifiers[fitz1Int];
        const fitz2 = fitzpatrickModifiers[fitz2Int];

        try {
          invariant(fitz1 != null && fitz2 != null, 'Invalid fitz: (%s, %s)', fitz1Int, fitz2Int);
        } catch (err) {
          console.log(err.message);
          continue;
        }

        // people holding hands: u1F9D1_u1F91D_u1F9D1
        // woman and man holding hands: u1F46B
        // men holding hands: u1F46C
        // women holding hands: u1F46D
        let baseAnnotation: typeof annotationData[keyof typeof annotationData];
        if (left === PERSON_CODEPOINT && right === PERSON_CODEPOINT) {
          baseAnnotation = annotationData['u1F9D1_u1F91D_u1F9D1'];
        } else if (left === WOMAN_CODEPOINT && right === MAN_CODEPOINT) {
          baseAnnotation = annotationData['u1F46B'];
        } else if (left === MAN_CODEPOINT && right === MAN_CODEPOINT) {
          baseAnnotation = annotationData['u1F46C'];
        } else if (left === WOMAN_CODEPOINT && right === WOMAN_CODEPOINT) {
          baseAnnotation = annotationData['u1F46D'];
        } else {
          invariant(false, 'unhandled emoji name: `%s`', emoji.name);
        }

        const fitz1Key = ('u' + fitz1.toString(16).toUpperCase()) as 'u1F3FB';
        const fitz2Key = ('u' + fitz2.toString(16).toUpperCase()) as 'u1F3FB';

        const fitz1Annotation = annotationData[fitz1Key];
        const fitz2Annotation = annotationData[fitz2Key];

        invariant(fitz1Annotation, 'Missing fitz1 annotation (%s)', fitz1Key);
        invariant(fitz2Annotation, 'Missing fitz2 annotation (%s)', fitz2Key);

        // example: u1F9D1_u1F91D_u1F9D1.55
        codepoints = [
          left, // left
          fitz1, // fitz1
          0x200d, //  zwj
          0x1f91d, // handshake
          0x200d, //  zwj
          right, // right
          fitz2, // fitz2
        ];

        name =
          baseAnnotation.name +
          ': ' +
          fitz1Annotation.name +
          (fitz1 === fitz2 ? '' : ', ' + fitz2Annotation.name) +
          ' (generated)';
        keywords.push(...baseAnnotation.keywords);

        keywords.push(fitz1Annotation.name);
        if (fitz1 !== fitz2) {
          keywords.push(fitz2Annotation.name);
        }
        char = String.fromCodePoint(...codepoints);
      } else {
        codepoints = annotation.codepoints;
        name = annotation.name;
        keywords.push(...annotation.keywords);
        char = annotation.char;
      }

      if (emoji.name in zwjSequenceData) {
        const seq = zwjSequenceData[emoji.name as keyof typeof zwjSequenceData];
        codepoints = seq.codepoints;
        char = seq.char;
        name = seq.description;
      } else if (emoji.name in variationSequenceData) {
        const seq = variationSequenceData[emoji.name as keyof typeof variationSequenceData];
        char = seq.char;
        seq.codepoints = seq.codepoints;
      } else if (emoji.name in sequenceData) {
        const seq = sequenceData[emoji.name as keyof typeof sequenceData];
        codepoints = seq.codepoints;
        char = seq.char;
        name = seq.description;
      }

      const emojilibEmojiKey = toEmojiKey(codepoints).replace(/(?:\.\d\d?)?(?:\.[MWBG]+)?$/, '');

      const emojilibDataItem =
        emojilibEmojiKey in emojilibData ? emojilibData[emojilibEmojiKey as keyof typeof emojilibData] : null;

      try {
        invariant(name, 'No name for %s', emoji.name);
        invariant(codepoints, 'No codepoints for %s', emoji.name);
        invariant(char, 'No emoji for %s', emoji.name);
      } catch (err) {
        console.error(err.message);
        continue;
      }

      const sortKey = toEmojiSortKey(codepoints);

      if (emojilibDataItem) {
        keywords.push(...emojilibDataItem.keywords);
      }

      keywords.sort();

      emojiDb[emoji.name] = {
        sortKey,
        codepoints,
        emoji: char,
        image: `images/${emoji.name}.png`,
        keywords: Array.from(new Set(keywords)),
        name,
        fitz: {},
        emojilib_name: emojilibDataItem?.emojilibKey ?? null,
        unicode_category: emojilibDataItem?.category ?? null,
        unicode_subcategory: null,
      };
    }

    await fs.promises.writeFile(absPath, stringify(emojiDb, sortKeyStringifyOptions));
  } catch (err) {
    console.error(err);
  } finally {
    await ttf.fh.close();
  }
})(process.argv.slice(2)).catch(err => {
  console.error(err);
  process.exit(1);
});
