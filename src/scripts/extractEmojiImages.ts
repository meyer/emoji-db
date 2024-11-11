import fs from 'fs';
import path from 'path';
import { EMOJI_IMG_DIR, FONTS_DIR } from '../constants.js';
import { emojiNameToKey } from '../utils/emojiNameToKey.js';
import { getFontByName } from '../utils/getFontByName.js';
import { getMetadataForEmojiKey } from '../utils/getMetadataForEmojiKey.js';
import { invariant } from '../utils/invariant.js';

const argv = process.argv.slice(2);
const firstArg = argv[0];
invariant(argv.length === 1 && firstArg, 'one arg pls');
const fontPath = path.join(FONTS_DIR, firstArg);
const ttf = await getFontByName(fontPath, 'AppleColorEmoji');

const imagePathsByKey: Record<string, string> = {};

try {
  await fs.promises.mkdir(EMOJI_IMG_DIR);
  for await (const { data, name } of ttf.getEmojiIterator()) {
    let filename: string;
    try {
      const key = emojiNameToKey(name);
      const { fileName: friendlyFileName } = getMetadataForEmojiKey(key);
      filename = `${friendlyFileName}.png`;
    } catch (err) {
      console.warn((err as any).message);
      filename = `ERROR-${name}.png`;
    }

    imagePathsByKey[name] = filename;

    await fs.promises.writeFile(path.join(EMOJI_IMG_DIR, filename), data, {
      // write should fail if the file already exists
      flag: 'wx',
    });
  }
} catch (err) {
  await ttf.fh.close();
  throw err;
}

const sortedImagePathsByKey = Object.entries(imagePathsByKey)
  .sort(([a], [b]) => a.localeCompare(b))
  .reduce<Record<string, string>>((prev, [key, value]) => {
    prev[key] = value;
    return prev;
  }, {});

await fs.promises.writeFile(
  path.join(EMOJI_IMG_DIR, 'manifest.json'),
  JSON.stringify(sortedImagePathsByKey, null, 2) + '\n'
);
