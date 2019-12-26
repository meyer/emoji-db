import path from 'path';
import fs from 'fs';
import { toEmojiKey } from '../utils/toEmojiKey';
import { CACHE_DIR, DATA_DIR } from '../constants';
import stringify from 'json-stable-stringify';

const groupRegex = /^# (sub)?(group)\: (.+)$/;
const lineRegex = /^([^;]+) ; ([^#]+) # (\S+) E([\d.]+) (.+)$/;

(async () => {
  const testDataPath = path.join(CACHE_DIR, 'emoji-test.txt');

  const testData = fs.readFileSync(testDataPath, 'utf-8');

  let currentGroup: string | null = null;
  let currentSubgroup: string | null = null;
  const emojiTestData: Record<string, any> = {};

  testData.split('\n').forEach(lineOrig => {
    const line = lineOrig.trim();
    const groupMatch = line.match(groupRegex);

    if (groupMatch) {
      const [, sub, group, desc] = groupMatch;

      if (sub) {
        currentSubgroup = desc.trim();
        console.log('\n%s --> %s', currentGroup, currentSubgroup);
      } else {
        currentGroup = group.trim();
      }
      return;
    }

    if (!line || line.startsWith('#')) {
      return;
    }

    const lineMatch = line.match(lineRegex);

    if (!lineMatch) {
      return;
    }

    const [, codepointString, qual, emoji, emojiVersion, desc] = lineMatch;

    if (qual === 'non-fully-qualified') {
      return;
    }

    const codepoints = codepointString
      .trim()
      .split(/\s+/)
      .map(f => parseInt(f, 16));
    const emojiKey = toEmojiKey(codepoints);

    console.log('wow: %s -- %s -- %s', emojiKey, emoji, desc);

    emojiTestData[emojiKey] = {
      emoji,
      desc,
      group: currentGroup,
      subgroup: currentSubgroup,
      since: parseFloat(emojiVersion),
    };
  });

  fs.writeFileSync(path.join(DATA_DIR, 'emoji-test.json'), stringify(emojiTestData, { space: 2 }));
})();
