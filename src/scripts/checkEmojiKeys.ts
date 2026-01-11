import path from 'path';
import { FONTS_DIR } from '../constants.js';
import { emojiNameToKey } from '../utils/emojiNameToKey.js';
import { getFontByName } from '../utils/getFontByName.js';
import { getMetadataForEmojiKey } from '../utils/getMetadataForEmojiKey.js';
import { invariant } from '../utils/invariant.js';

const argv = process.argv.slice(2);
const firstArg = argv[0];
invariant(argv.length === 1 && firstArg, 'one arg pls');
const fontPath = path.join(FONTS_DIR, firstArg);
const ttf = await getFontByName(fontPath, 'AppleColorEmoji');

let hasErrors = 0;

// Skip component/silhouette images - they're composition building blocks, not standalone emoji
const componentRegex = /^silhouette\.|\.(?:L|R|RA)$/;

try {
  for await (const result of ttf.getEmojiIterator()) {
    // Skip dupe references
    if (result.type === 'ref') {
      continue;
    }

    const { name } = result;

    // Skip component images
    if (componentRegex.test(name)) {
      continue;
    }

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
