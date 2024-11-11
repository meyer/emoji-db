import fs from 'fs';
// https://docs.microsoft.com/en-us/typography/opentype/spec/otff
import path from 'path';
import emojilibData from 'emojilib/dist/emoji-en-US.json';
import stringify from 'json-stable-stringify';
import { DATA_DIR } from '../constants';
import { codepointsToKey } from '../utils/codepointsToKey';
import { invariant } from '../utils/invariant';
import { sortKeyStringifyOptions } from '../utils/sortKeyStringifyOptions';
import { toCodepoints } from '../utils/toCodepoints';
import { toEmojiSortKey } from '../utils/toEmojiSortKey';
(async () => {
  const emojilibDataByEmojiKey: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(emojilibData)) {
    const codepoints = toCodepoints(key);
    const emojiKey = codepointsToKey(codepoints);
    const sortKey = toEmojiSortKey(codepoints);

    invariant(!(emojiKey in emojilibDataByEmojiKey), 'Duplicate emoji key:', emojiKey);

    emojilibDataByEmojiKey[emojiKey] = {
      emojilibKey: key,
      sortKey,
      ...value,
    };
  }

  fs.writeFileSync(path.join(DATA_DIR, 'emojilib.json'), stringify(emojilibDataByEmojiKey, sortKeyStringifyOptions));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
