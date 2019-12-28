import path from 'path';
import fs from 'fs';
import { codepointsToKey } from '../utils/codepointsToKey';
import { CACHE_DIR, DATA_DIR } from '../constants';
import stringify from 'json-stable-stringify';
import { toEmojiSortKey } from '../utils/toEmojiSortKey';
import { sortKeyStringifyOptions } from '../utils/sortKeyStringifyOptions';

const groupRegex = /^# (sub)?group\: (.+)$/;
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
      const [, sub, desc] = groupMatch;

      if (sub) {
        currentSubgroup = desc.trim();
        console.log('\n%s --> %s', currentGroup, currentSubgroup);
      } else {
        currentGroup = desc.trim();
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
    const emojiKey = codepointsToKey(codepoints);
    const sortKey = toEmojiSortKey(codepoints);

    console.log('wow: %s -- %s -- %s', emojiKey, emoji, desc);

    emojiTestData[emojiKey] = {
      emoji,
      sortKey,
      desc,
      group: currentGroup,
      subgroup: currentSubgroup,
      since: parseFloat(emojiVersion),
    };
  });

  fs.writeFileSync(path.join(DATA_DIR, 'emoji-test.json'), stringify(emojiTestData, sortKeyStringifyOptions));
})();
