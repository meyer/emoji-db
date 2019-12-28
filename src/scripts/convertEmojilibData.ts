// https://docs.microsoft.com/en-us/typography/opentype/spec/otff
import path from 'path';
import fs from 'fs';
import { DATA_DIR } from '../constants';
import { invariant } from '../utils/invariant';
import stringify from 'json-stable-stringify';
import { sortKeyStringifyOptions } from '../utils/sortKeyStringifyOptions';
import { toEmojiSortKey } from '../utils/toEmojiSortKey';
import emojilibData from 'emojilib/emojis.json';
import { toCodepoints } from '../utils/toCodepoints';
import { codepointsToKey } from '../utils/codepointsToKey';

(async () => {
  const emojilibDataByEmojiKey: Record<string, any> = {};

  for (const [key, value] of Object.entries(emojilibData)) {
    const codepoints = toCodepoints(value.char);
    const emojiKey = codepointsToKey(codepoints);
    const sortKey = toEmojiSortKey(codepoints);

    invariant(!emojilibDataByEmojiKey.hasOwnProperty(emojiKey), 'Duplicate emoji key:', emojiKey);

    emojilibDataByEmojiKey[emojiKey] = {
      emojilibKey: key,
      sortKey,
      ...value,
    };
  }

  fs.writeFileSync(path.join(DATA_DIR, 'emojilib.json'), stringify(emojilibDataByEmojiKey, sortKeyStringifyOptions));
})().catch(err => {
  console.error(err);
  process.exit(1);
});
