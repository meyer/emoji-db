import cheerio from 'cheerio';
import path from 'path';
import fs from 'fs';
import { toCodepoints } from '../utils/toCodepoints';
import { toEmojiKey } from '../utils/toEmojiKey';
import { CACHE_DIR, DATA_DIR } from '../constants';
import { invariant } from '../utils/invariant';

(async () => {
  const annotationFile = path.join(CACHE_DIR, 'annotations.xml');
  const content = await fs.promises.readFile(annotationFile, 'utf8');
  const $ = cheerio.load(content, { xmlMode: true });

  const annotations = $('ldml > annotations > annotation');

  const ret: Record<string, any> = {};
  annotations.map((idx, el) => {
    const codepoints = toCodepoints(el.attribs.cp);
    const key = toEmojiKey(codepoints);

    if (!ret[key]) {
      ret[key] = {
        char: el.attribs.cp,
        codepoints,
      };
    } else {
      invariant(ret[key].char === el.attribs.cp, 'char !== el.attribs.cp');
    }
    if (el.attribs.type === 'tts') {
      ret[key].name = $(el)
        .text()
        .trim();
    } else {
      ret[key].keywords = $(el)
        .text()
        .split('|')
        .map(s => s.trim());
    }
  });

  await fs.promises.writeFile(path.join(DATA_DIR, 'annotations.json'), JSON.stringify(ret, null, 2));
})();
