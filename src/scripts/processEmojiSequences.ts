import path from 'path';
import fs from 'fs';
import { toEmojiKey } from '../utils/toEmojiKey';
import { invariant } from '../utils/invariant';
import { CACHE_DIR, DATA_DIR } from '../constants';
import stringify from 'json-stable-stringify';

(async () => {
  [
    // 23F3 ; Basic_Emoji ; hourglass not done
    'emoji-sequences.txt',
    // 1F468 200D 2764 FE0F 200D 1F468 ; Emoji_ZWJ_Sequence ; couple with heart: man, man
    'emoji-zwj-sequences.txt',
    // 0023 FE0E  ; text style;
    'emoji-variation-sequences.txt',
  ].forEach(txtFile => {
    const sequenceData: Record<string, any> = {};
    const txtPath = path.join(CACHE_DIR, txtFile);
    const basename = path.basename(txtFile, '.txt');

    const txtFileContent = fs.readFileSync(txtPath, 'utf8');

    txtFileContent.split('\n').forEach((line, idx) => {
      if (line.startsWith('#') || line === '') {
        console.info('Ignoring line:', line);
        return;
      }

      // strip off trailing comments
      const lineSansComment = line.split('#')[0];
      const lineBits = lineSansComment.split(';').map(f => f.trim());

      if (lineBits.length !== 3) {
        console.info('Skipping line %s: `%s`', idx, line);
        return;
      }

      const [codepointString, category, description] = lineBits;

      // codepointString is a string of space-separated hex codepoint strings
      // we split the string on spaces and parse the hex strings to ints
      const codepoints = codepointString.split(/\s+/).map(f => parseInt(f, 16));
      const emojiKey = toEmojiKey(codepoints);

      invariant(!sequenceData.hasOwnProperty(emojiKey), 'Already have a thing for `%s`!', emojiKey);

      if (txtFile === 'emoji-variation-sequences.txt') {
        if (category === 'emoji style') {
          sequenceData[emojiKey] = { codepoints };
        } else {
          console.info('Skipping line `%s`', line);
        }
      } else {
        sequenceData[emojiKey] = { codepoints, description };
      }
    });

    fs.writeFileSync(path.join(DATA_DIR, `${basename}.json`), stringify(sequenceData, { space: 2 }));
  });
})();
