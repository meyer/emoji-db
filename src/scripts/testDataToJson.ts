import fs from 'fs';
import path from 'path';
import stringify from 'json-stable-stringify';
import { CACHE_DIR, DATA_DIR } from '../constants.js';
import { codepointsToKey } from '../utils/codepointsToKey.js';
import { sortKeyStringifyOptions } from '../utils/sortKeyStringifyOptions.js';
import { toEmojiSortKey } from '../utils/toEmojiSortKey.js';

const groupRegex = /^# (sub)?group\: (.+)$/;
const lineRegex = /^([^;]+) ; ([^#]+) # (\S+) E([\d.]+) (.+)$/;

const testDataPath = path.join(CACHE_DIR, 'emoji-test.txt');

const testData = fs.readFileSync(testDataPath, 'utf-8');

let currentGroup: string | null = null;
let currentSubgroup: string | null = null;
const emojiTestData: Record<string, unknown> = {};

for (const lineOrig of testData.split('\n')) {
  const line = lineOrig.trim();
  const groupMatch = line.match(groupRegex);

  if (groupMatch) {
    const [, sub, desc] = groupMatch;

    if (sub) {
      currentSubgroup = desc!.trim();
      console.log('\n%s --> %s', currentGroup, currentSubgroup);
    } else {
      currentGroup = desc!.trim();
    }
    continue;
  }

  if (!line || line.startsWith('#')) {
    continue;
  }

  const lineMatch = line.match(lineRegex);

  if (!lineMatch) {
    continue;
  }

  const [, codepointString, qual, emoji, emojiVersion, desc] = lineMatch;

  if (qual === 'non-fully-qualified') {
    continue;
  }

  const codepoints = codepointString!
    .trim()
    .split(/\s+/)
    .map((f) => Number.parseInt(f, 16));
  const emojiKey = codepointsToKey(codepoints);
  const sortKey = toEmojiSortKey(codepoints);

  console.log('wow: %s -- %s -- %s', emojiKey, emoji, desc);

  emojiTestData[emojiKey] = {
    emoji,
    sortKey,
    desc,
    group: currentGroup,
    subgroup: currentSubgroup,
    since: Number.parseFloat(emojiVersion!),
  };
}

fs.writeFileSync(path.join(DATA_DIR, 'emoji-test.json'), stringify(emojiTestData, sortKeyStringifyOptions));
