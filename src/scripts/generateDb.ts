// https://docs.microsoft.com/en-us/typography/opentype/spec/otff
import path from 'path';
import fs from 'fs';
import { FONTS_DIR, ROOT_DIR } from '../constants';
import { invariant } from '../utils/invariant';
import { getFontByName } from '../utils/getFontByName';
import stringify from 'json-stable-stringify';
import { sortKeyStringifyOptions } from '../utils/sortKeyStringifyOptions';
import { toEmojiSortKey } from '../utils/toEmojiSortKey';
import { emojiNameToKey } from '../utils/emojiNameToKey';
import { getMetadataForEmojiKey } from '../utils/getMetadataForEmojiKey';
import yaml from 'yaml';

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

const fitzRegex = /\.([1-5][1-5]?)(\.[MWBG]+)?$/;

(async (argv) => {
  invariant(argv.length === 1, 'one arg pls');
  const fontPath = path.join(FONTS_DIR, argv[0]);
  const ttf = await getFontByName(fontPath, 'AppleColorEmoji');

  const emojiDb: EmojiDb = {};
  const absPath = path.join(ROOT_DIR, 'emoji-db.json');

  const keywordsByEmoji: Record<string, string[] | undefined> = yaml.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'extra-keywords.yaml'), 'utf8')
  );

  try {
    for await (const emoji of ttf.getEmojiIterator()) {
      const keyFromName = emojiNameToKey(emoji.name);

      const { codepoints, char, keywords, name, emojilibDataItem, fileName } = getMetadataForEmojiKey(keyFromName);

      const sortKey = toEmojiSortKey(codepoints);

      if (emojilibDataItem) {
        keywords.push(...emojilibDataItem.keywords);
      }

      const extraKeywords = keywordsByEmoji[keyFromName];
      if (extraKeywords) {
        keywords.push(...extraKeywords);
      }

      keywords.sort();

      const fitzMatch = keyFromName.match(fitzRegex);

      if (fitzMatch) {
        const zeroKey = keyFromName.replace(fitzRegex, '$2');

        emojiDb[zeroKey] = {
          ...emojiDb[zeroKey],
          fitz: {
            ...emojiDb[zeroKey]?.fitz,
            [fitzMatch[1]]: {
              name,
              image: `images/${fileName}.png`,
              emoji: char,
              codepoints,
            },
          },
        };
      } else {
        emojiDb[keyFromName] = {
          sortKey,
          codepoints,
          emoji: char,
          image: `images/${fileName}.png`,
          keywords: Array.from(new Set(keywords)),
          name,
          fitz: null,
          emojilib_name: emojilibDataItem?.emojilibKey ?? null,
          unicode_category: emojilibDataItem?.category ?? null,
          unicode_subcategory: null,
          ...emojiDb[keyFromName],
        };
      }
    }

    const errors: string[] = [];

    // make we're generating valid entries
    Object.entries(emojiDb).forEach(([key, value]) => {
      if (!value.codepoints) {
        errors.push(`${key} is missing codepoints`);
      }
    });

    invariant(errors.length === 0, 'Encountered %s errors: %o', errors.length, errors);

    await fs.promises.writeFile(absPath, stringify(emojiDb, sortKeyStringifyOptions));
  } catch (err) {
    console.error(err);
    await ttf.fh.close();
    throw err;
  }
})(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
