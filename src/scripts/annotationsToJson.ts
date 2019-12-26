import cheerio from 'cheerio';
import path from 'path';
import fs from 'fs';
import { toCodepoints } from '../utils/toCodepoints';
import { toEmojiKey } from '../utils/toEmojiKey';
import { CACHE_DIR, DATA_DIR } from '../constants';
import { invariant } from '../utils/invariant';
import stringify from 'json-stable-stringify';

interface Annotation {
  char: string;
  codepoints: number[];
  keywords: null | string[];
  name: null | string;
}

(async () => {
  const files = ['annotations.xml', 'annotationsDerived.xml'];

  for (const fileName of files) {
    const annotationFile = path.join(CACHE_DIR, fileName);
    const content = await fs.promises.readFile(annotationFile, 'utf8');
    const $ = cheerio.load(content, { xmlMode: true });

    const annotations = $('ldml > annotations > annotation');

    const ret: Record<string, Annotation> = {};
    annotations.map((idx, el) => {
      const codepoints = toCodepoints(el.attribs.cp);
      const key = toEmojiKey(codepoints);

      if (!ret[key]) {
        ret[key] = {
          name: null,
          char: el.attribs.cp,
          codepoints,
          keywords: null,
        };
      } else {
        invariant(ret[key].char === el.attribs.cp, 'char !== el.attribs.cp (`%s`)', key);
      }
      if (el.attribs.type === 'tts') {
        invariant(!ret[key].name, '`ret[%s].name` is already set', key);
        ret[key].name = $(el)
          .text()
          .trim();
      } else {
        invariant(!ret[key].keywords, '`ret[%s].keywords` is already set', key);
        ret[key].keywords = $(el)
          .text()
          .split('|')
          .map(s => s.trim());
      }
    });

    const basename = path.basename(fileName, '.xml');
    await fs.promises.writeFile(path.join(DATA_DIR, `${basename}.json`), stringify(ret, { space: 2 }));
  }
})();
