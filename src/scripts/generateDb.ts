import fs from 'fs';
import path from 'path';
import stringify from 'json-stable-stringify';
import yaml from 'yaml';
import { FONTS_DIR, ROOT_DIR } from '../constants.js';
import { emojiNameToKey } from '../utils/emojiNameToKey.js';
import { getFontByName } from '../utils/getFontByName.js';
import { getMetadataForEmojiKey } from '../utils/getMetadataForEmojiKey.js';
import { invariant } from '../utils/invariant.js';
import { sortKeyStringifyOptions } from '../utils/sortKeyStringifyOptions.js';
import { toEmojiSortKey } from '../utils/toEmojiSortKey.js';

interface EmojiDbEntry {
  name: string;
  codepoints: number[];
  unicode_category?: string;
  unicode_subcategory?: string;
  keywords: string[];
  emoji: string;
  image: string;
  fitz: null | Record<string, Pick<EmojiDbEntry, 'name' | 'image' | 'emoji' | 'codepoints'>>;
  sortKey: string;
}

type EmojiDb = Record<string, EmojiDbEntry>;

const fitzRegex = /\.([1-5][1-5]?)(\.[MWBG]+)?$/;
const argv = process.argv.slice(2);
const firstArg = argv[0];
invariant(argv.length === 1 && firstArg, 'one arg pls');
const fontPath = path.join(FONTS_DIR, firstArg);
const ttf = await getFontByName(fontPath, 'AppleColorEmoji');

const emojiDb: EmojiDb = {};
const absPath = path.join(ROOT_DIR, 'emoji-db.json');

const keywordsByEmoji: Record<string, string[]> = yaml.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'extra-keywords.yaml'), 'utf8')
);

try {
  for await (const emoji of ttf.getEmojiIterator()) {
    let keyFromName: string;
    try {
      keyFromName = emojiNameToKey(emoji.name);
    } catch (err) {
      console.warn(err);
      continue;
    }

    const { codepoints, char, keywords, name, fileName } = getMetadataForEmojiKey(keyFromName);

    const sortKey = toEmojiSortKey(codepoints);

    const extraKeywords = keywordsByEmoji[keyFromName];
    if (extraKeywords) {
      keywords.push(...extraKeywords);
    }

    keywords.sort();

    const fitzMatch = keyFromName.match(fitzRegex);

    if (fitzMatch?.[1]) {
      const zeroKey = keyFromName.replace(fitzRegex, '$2');

      // @ts-expect-error partial is OK
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
        ...emojiDb[keyFromName],
      };
    }
  }

  const errors: string[] = [];

  // make we're generating valid entries
  for (const [key, value] of Object.entries(emojiDb)) {
    if (!value.codepoints) {
      errors.push(`${key} is missing codepoints`);
    }
  }

  invariant(errors.length === 0, 'Encountered %s errors: %o', errors.length, errors);

  await fs.promises.writeFile(absPath, stringify(emojiDb, sortKeyStringifyOptions));
} catch (err) {
  console.error(err);
  await ttf.fh.close();
  throw err;
}
