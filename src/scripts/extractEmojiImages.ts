import fs from 'fs';
// https://docs.microsoft.com/en-us/typography/opentype/spec/otff
import path from 'path';
import { EMOJI_IMG_DIR, FONTS_DIR } from '../constants';
import { emojiNameToKey } from '../utils/emojiNameToKey';
import { getFontByName } from '../utils/getFontByName';
import { getMetadataForEmojiKey } from '../utils/getMetadataForEmojiKey';
import { invariant } from '../utils/invariant';
(async (argv) => {
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
        filename = friendlyFileName + '.png';
      } catch (err) {
        console.warn((err as any).message);
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
    JSON.stringify(sortedImagePathsByKey, null, 2) + '\n'
  );
})(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
