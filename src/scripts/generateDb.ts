// https://docs.microsoft.com/en-us/typography/opentype/spec/otff
import path from 'path';
import fs from 'fs';
import { FONTS_DIR, ROOT_DIR } from '../constants';
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
  fitz: null | Record<string, Pick<EmojiDbEntry, 'name' | 'image' | 'emoji' | 'codepoints'>>;
  sortKey: string;
}

type EmojiDb = Record<string, EmojiDbEntry>;

const holdingHandRegex = /^(u1F(?:46[89]|9D1)_u1F91D_u1F(?:46[89]|9D1))\.([0-6])([0-6])$/;
const fitzRegex = /\.([0-6][0-6]?)(\.[MWBG]+)?$/;

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

      const basename = emoji.name.replace(/(?:\.(?:0|66)$|\.(?:0|66)(\.[MW])$)/, '$1');
      const annotation =
        basename in derivedAnnotationData
          ? derivedAnnotationData[basename as keyof typeof derivedAnnotationData]
          : basename in annotationData
          ? annotationData[basename as keyof typeof annotationData]
          : null;

      if (!annotation) {
        // The Apple Color Emoji font file contains unique images for the same skin tone pairs used left-right and right-left,
        // but the unicode CLDR derived annotation data only contains entries for right-left pairs.
        // For example, emoji `xyz` has images for `xyz.12` _and_ `xyz.21`, but annotation data only contains `xyz.21`.
        // We pull keywords from the `21` case for the `12` case. ZWJ data will provide the remaining pieces.
        const match = emoji.name.match(holdingHandRegex);
        invariant(match, 'emoji.name does not match holdingHandRegex (`%s`)', emoji.name);

        const fallbackKey = `${match[1]}.${match[3]}${match[2]}`;
        console.log('Missing annotation for `%s`, falling back to `%s`', emoji.name, fallbackKey);

        const fallbackAnnotation = derivedAnnotationData[fallbackKey as keyof typeof derivedAnnotationData];
        invariant(fallbackAnnotation, 'Missing fallbackAnnotation for key `%s`', fallbackKey);

        keywords.push(...fallbackAnnotation.keywords);
      } else {
        codepoints = annotation.codepoints;
        name = annotation.name;
        keywords.push(...annotation.keywords);
        char = annotation.char;
      }

      if (emoji.name in zwjSequenceData) {
        const seq = zwjSequenceData[emoji.name as keyof typeof zwjSequenceData];
        char = seq.char;
        codepoints = seq.codepoints;
        name = seq.description;
      }

      if (emoji.name in variationSequenceData) {
        const seq = variationSequenceData[emoji.name as keyof typeof variationSequenceData];
        char = seq.char;
        codepoints = seq.codepoints;
      }

      if (emoji.name in sequenceData) {
        const seq = sequenceData[emoji.name as keyof typeof sequenceData];
        char = seq.char;
        codepoints = seq.codepoints;
        name = seq.description;
      }

      invariant(codepoints, 'Emoji name `%s` was not present in any data file', emoji.name);

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

      const fitzMatch = emoji.name.match(fitzRegex);

      if (fitzMatch && fitzMatch[1] !== '0') {
        const zeroKey = emoji.name.replace(fitzRegex, '.0$2');

        emojiDb[zeroKey] = {
          ...emojiDb[zeroKey],
          fitz: {
            ...emojiDb[zeroKey]?.fitz,
            [fitzMatch[1]]: {
              name,
              image: `images/${emoji.name}.png`,
              emoji: char,
              codepoints,
            },
          },
        };
      } else {
        emojiDb[emoji.name] = {
          sortKey,
          codepoints,
          emoji: char,
          image: `images/${emoji.name}.png`,
          keywords: Array.from(new Set(keywords)),
          name,
          fitz: null,
          emojilib_name: emojilibDataItem?.emojilibKey ?? null,
          unicode_category: emojilibDataItem?.category ?? null,
          unicode_subcategory: null,
          ...emojiDb[emoji.name],
        };
      }
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
