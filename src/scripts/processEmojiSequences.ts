import path from 'path';
import fs from 'fs';
import { codepointsToKey } from '../utils/codepointsToKey';
import { invariant } from '../utils/invariant';
import { CACHE_DIR, DATA_DIR } from '../constants';
import stringify from 'json-stable-stringify';
import { toEmojiSortKey } from '../utils/toEmojiSortKey';
import { sortKeyStringifyOptions } from '../utils/sortKeyStringifyOptions';
(async () => {
  [
    // 23F3 ; Basic_Emoji ; hourglass not done
    'emoji-sequences.txt',
    // 1F468 200D 2764 FE0F 200D 1F468 ; Emoji_ZWJ_Sequence ; couple with heart: man, man
    'emoji-zwj-sequences.txt',
    // 0023 FE0E  ; text style;
    'emoji-variation-sequences.txt',
  ].forEach((txtFile) => {
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
      const lineBits = lineSansComment.split(';').map((f) => f.trim());

      if (lineBits.length !== 3) {
        console.info('Skipping line %s: `%s`', idx, line);
        return;
      }

      const [codepointString, category, description] = lineBits;

      // codepointString is a string of space-separated hex codepoint strings
      // we split the string on spaces and parse the hex strings to ints
      const codepoints = codepointString.split(/\s+/).map((f) => parseInt(f, 16));
      const emojiKey = codepointsToKey(codepoints);
      const sortKey = toEmojiSortKey(codepoints);

      invariant(!sequenceData.hasOwnProperty(emojiKey), 'Already have a thing for `%s`!', emojiKey);

      const char = String.fromCodePoint(...codepoints);

      if (txtFile === 'emoji-variation-sequences.txt') {
        if (category === 'emoji style') {
          sequenceData[emojiKey] = { codepoints, char, sortKey };
        } else {
          console.info('Skipping line `%s`', line);
        }
      } else {
        sequenceData[emojiKey] = {
          codepoints,
          char,
          // according to emoji-sequences.txt, "characters may be escaped with \x{hex}". this undoes that escaping.
          description: description.replace(/\\x\{([0-9A-F]+)\}/gi, (_all, group1) => {
            return String.fromCodePoint(parseInt(group1, 16));
          }),
          sortKey,
        };
      }
    });

    fs.writeFileSync(path.join(DATA_DIR, `${basename}.json`), stringify(sequenceData, sortKeyStringifyOptions));
  });
})();
