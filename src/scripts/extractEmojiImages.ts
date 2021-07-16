// https://docs.microsoft.com/en-us/typography/opentype/spec/otff
import path from 'path';
import fs from 'fs';
import { FONTS_DIR, EMOJI_IMG_DIR } from '../constants';
import { invariant } from '../utils/invariant';
import { getFontByName } from '../utils/getFontByName';
import { emojiNameToKey } from '../utils/emojiNameToKey';
import { getMetadataForEmojiKey } from '../utils/getMetadataForEmojiKey';

(async (argv) => {
  invariant(argv.length === 1, 'one arg pls');
  const fontPath = path.join(FONTS_DIR, argv[0]);
  const ttf = await getFontByName(fontPath, 'AppleColorEmoji');

  const imagePathsByKey: Record<string, string> = {};

  try {
    await fs.promises.mkdir(EMOJI_IMG_DIR);
    for await (const { data, name } of ttf.getEmojiIterator()) {
      let filename: string;
      try {
        const key = emojiNameToKey(name);
        const { fileName: friendlyFileName } = getMetadataForEmojiKey(key);
        filename = friendlyFileName + '.png';
      } catch (err) {
        console.warn(err.message);
        filename = 'ERROR-' + name + '.png';
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
    JSON.stringify(sortedImagePathsByKey, null, 2)
  );
})(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
