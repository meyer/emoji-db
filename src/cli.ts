// https://docs.microsoft.com/en-us/typography/opentype/spec/otff
import path from 'path';
import fs from 'fs';
import {
  FONTS_DIR,
  EMOJI_IMG_DIR,
  // DATA_DIR,
} from './constants';
import { toCodepoints } from './utils/toCodepoints';
import { toEmojiKey } from './utils/toEmojiKey';
import { normaliseBasename } from './utils/normaliseBasename';
import { invariant } from './utils/invariant';
import emojiData from 'emojilib/emojis.json';
import annotationData from '../data/annotations.json';
import { getFontByName } from './utils/getFontByName';

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
  const fontPath = path.join(FONTS_DIR, argv[0]);
  const ttf = await getFontByName(fontPath, 'AppleColorEmoji');
  const manifest: Record<string, any> = {};

  try {
    manifest.name = ttf.name.fontFamilyName;
    manifest.version = ttf.name.versionString;
    manifest.created = ttf.head.created;
    manifest.modified = ttf.head.modified;

    await fs.promises.mkdir(EMOJI_IMG_DIR);

    const emojiByKey: Record<string, any> = {};

    for await (const { data, name } of ttf.getEmojiIterator()) {
      const basename = normaliseBasename(name);
      const emojilibData = emojiDataByKey.hasOwnProperty(basename) ? emojiDataByKey[basename] : null;
      const emojilibName = emojilibData?.name ?? null;
      if (!emojilibData) {
        console.log('No emojilib data for %s (%s)', basename, name);
      }

      const annotation = annotationData.hasOwnProperty(basename)
        ? annotationData[basename as keyof typeof annotationData]
        : null;

      if (!annotation) {
        console.log('No annotation data for %s (%s)', basename, name);
      }

      const absPath = path.join(EMOJI_IMG_DIR, name + '.png');

      await fs.promises.writeFile(absPath, data, {
        // write should fail if the file already exists
        flag: 'wx',
      });

      emojiByKey[name] = {
        emojilibName,
        keywords: [],
        char: null,
        annotation,
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
    await ttf.fh.close();
  }
})(process.argv.slice(2)).catch(err => {
  console.error(err);
  process.exit(1);
});
