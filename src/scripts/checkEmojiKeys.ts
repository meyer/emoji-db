// https://docs.microsoft.com/en-us/typography/opentype/spec/otff
import path from 'path';
import { FONTS_DIR } from '../constants';
import { getFontByName } from '../utils/getFontByName';
import { emojiNameToKey } from '../utils/emojiNameToKey';
import { invariant } from '../utils/invariant';
import { getMetadataForEmojiKey } from '../utils/getMetadataForEmojiKey';

(async (argv) => {
  invariant(argv.length === 1, 'one arg pls');
  const fontPath = path.join(FONTS_DIR, argv[0]);
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
    throw new Error('Error getting key for ' + hasErrors + ' emoji');
  }
})(process.argv.slice(2)).catch((err) => {
  console.error(err);
  process.exit(1);
});
