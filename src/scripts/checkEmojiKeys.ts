import path from 'path';
import { FONTS_DIR } from '../constants';
import { emojiNameToKey } from '../utils/emojiNameToKey';
import { getFontByName } from '../utils/getFontByName';
import { getMetadataForEmojiKey } from '../utils/getMetadataForEmojiKey';
import { invariant } from '../utils/invariant';

(async (argv) => {
  const firstArg = argv[0];
  invariant(argv.length === 1 && firstArg, 'one arg pls');
  const fontPath = path.join(FONTS_DIR, firstArg);
  const ttf = await getFontByName(fontPath, 'AppleColorEmoji');

  let hasErrors = 0;

  try {
    for await (const { name } of ttf.getEmojiIterator()) {
      try {
        const key = emojiNameToKey(name);
        const { char } = getMetadataForEmojiKey(key);
        console.log('%s --> %s', name, key, char);
      } catch (err) {
        hasErrors++;
        console.error('🔴 %s', name);
      }
    }
  } catch (err) {
    await ttf.fh.close();
    throw err;
  }

  if (hasErrors > 0) {
    throw new Error(`Error getting key for ${hasErrors} emoji`);
  }
})(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
