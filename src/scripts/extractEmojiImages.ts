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
// Track pending dupe references to resolve after all data is written
const pendingDupes: Array<{ name: string; refName: string }> = [];

// Regex to detect component/silhouette images
// These are composition building blocks, not standalone emoji
const componentRegex = /^silhouette\.|\.(?:L|R|RA)$/;

const COMPONENTS_DIR = path.join(EMOJI_IMG_DIR, 'components');

try {
  await fs.promises.mkdir(EMOJI_IMG_DIR);
  await fs.promises.mkdir(COMPONENTS_DIR);

  for await (const result of ttf.getEmojiIterator()) {
    if (result.type === 'ref') {
      // Dupe reference - we'll resolve this after all data images are written
      pendingDupes.push({ name: result.name, refName: result.refName });
      continue;
    }

    // type === 'data'
    const { data, name } = result;

    // Check if this is a component/silhouette image
    const isComponent = componentRegex.test(name);

    let filename: string;
    let targetDir: string;

    if (isComponent) {
      // Component images go to components/ with simple names
      filename = `${name}.png`;
      targetDir = COMPONENTS_DIR;
    } else {
      try {
        const key = emojiNameToKey(name);
        const { fileName: friendlyFileName } = getMetadataForEmojiKey(key);
        filename = `${friendlyFileName}.png`;
        targetDir = EMOJI_IMG_DIR;
      } catch (err) {
        // biome-ignore lint/suspicious/noExplicitAny: its fine
        console.warn((err as any).message);
        filename = `ERROR-${name}.png`;
        targetDir = EMOJI_IMG_DIR;
      }
    }

    // Store path relative to EMOJI_IMG_DIR for manifest
    const relativePath = isComponent ? `components/${filename}` : filename;
    imagePathsByKey[name] = relativePath;

    await fs.promises.writeFile(path.join(targetDir, filename), data, {
      // write should fail if the file already exists
      flag: 'wx',
    });
  }

  // Resolve dupe references - point to the same file as the referenced glyph
  for (const { name, refName } of pendingDupes) {
    const refFilename = imagePathsByKey[refName];
    if (refFilename) {
      imagePathsByKey[name] = refFilename;
    } else {
      console.warn(`Dupe reference not found in manifest: ${name} -> ${refName}`);
    }
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
