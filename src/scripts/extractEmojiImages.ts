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
  const errors = [];

  try {
    await fs.promises.mkdir(EMOJI_IMG_DIR);
    for await (const { data, name } of ttf.getEmojiIterator()) {
      let absPath: string;
      try {
        const key = emojiNameToKey(name);
        const { fileName } = getMetadataForEmojiKey(key);
        absPath = path.join(EMOJI_IMG_DIR, fileName + '.png');
      } catch (err) {
        errors.push(err);
        console.error('Error with %s:', name, err);
        absPath = path.join(EMOJI_IMG_DIR, name + '.png');
      }

      await fs.promises.writeFile(absPath, data, {
        // write should fail if the file already exists
        flag: 'wx',
      });
    }
  } catch (err) {
    await ttf.fh.close();
    throw err;
  }

  if (errors.length) {
    throw new Error('Error extracting images');
  }
})(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
