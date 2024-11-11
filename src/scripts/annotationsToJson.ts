import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import stringify from 'json-stable-stringify';
import { CACHE_DIR, DATA_DIR } from '../constants';
import { codepointsToKey } from '../utils/codepointsToKey';
import { invariant } from '../utils/invariant';
import { sortKeyStringifyOptions } from '../utils/sortKeyStringifyOptions';
import { toCodepoints } from '../utils/toCodepoints';
import { toEmojiSortKey } from '../utils/toEmojiSortKey';

interface Annotation {
  char: string;
  codepoints: number[];
  keywords: null | string[];
  name: null | string;
}

interface AnnotationWithSortKey extends Annotation {
  sortKey: string;
}
(async () => {
  const files = ['annotations.xml', 'annotationsDerived.xml'];

  for (const fileName of files) {
    const annotationFile = path.join(CACHE_DIR, fileName);
    const content = await fs.promises.readFile(annotationFile, 'utf8');
    const $ = cheerio.load(content, { xmlMode: true });

    const annotations = $('ldml > annotations > annotation');

    const ret: Record<string, AnnotationWithSortKey> = {};
    annotations.map((idx, el) => {
      const codepoints = toCodepoints(el.attribs.cp!);
      const key = codepointsToKey(codepoints);
      const sortKey = toEmojiSortKey(codepoints);

      if (!ret[key]) {
        ret[key] = {
          name: null,
          char: el.attribs.cp!,
          codepoints,
          keywords: null,
          sortKey,
        };
      } else {
        invariant(ret[key].char === el.attribs.cp, 'char !== el.attribs.cp (`%s`)', key);
      }
      if (el.attribs.type === 'tts') {
        invariant(!ret[key].name, '`ret[%s].name` is already set', key);
        ret[key].name = $(el).text().trim();
      } else {
        invariant(!ret[key].keywords, '`ret[%s].keywords` is already set', key);
        ret[key].keywords = $(el)
          .text()
          .split('|')
          .map((s) => s.trim());
      }
    });

    const basename = path.basename(fileName, '.xml');
    await fs.promises.writeFile(path.join(DATA_DIR, `${basename}.json`), stringify(ret, sortKeyStringifyOptions));
  }
})();
