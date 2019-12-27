// https://docs.microsoft.com/en-us/typography/opentype/spec/otff
import path from 'path';
import fs from 'fs';
import { FONTS_DIR, EMOJI_IMG_DIR } from '../constants';
import { invariant } from '../utils/invariant';
import { getFontByName } from '../utils/getFontByName';

(async argv => {
  invariant(argv.length === 1, 'one arg pls');
  const fontPath = path.join(FONTS_DIR, argv[0]);
  const ttf = await getFontByName(fontPath, 'AppleColorEmoji');

  try {
    await fs.promises.mkdir(EMOJI_IMG_DIR);
    for await (const { data, name } of ttf.getEmojiIterator()) {
      const absPath = path.join(EMOJI_IMG_DIR, name + '.png');

      await fs.promises.writeFile(absPath, data, {
        // write should fail if the file already exists
        flag: 'wx',
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    await ttf.fh.close();
  }
})(process.argv.slice(2)).catch(err => {
  console.error(err);
  process.exit(1);
});
