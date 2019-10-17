// https://docs.microsoft.com/en-us/typography/opentype/spec/otff
import path from 'path';
import fs from 'fs';
import { WrappedAsyncIterator } from './WrappedAsyncIterator';

const ROOT_DIR = path.resolve(__dirname, '..');
const FONTS_DIR = path.join(ROOT_DIR, 'fonts');

(async argv => {
  let fd: number | undefined;
  try {
    if (argv.length !== 1) {
      throw new Error('one arg pls');
    }

    const fontPath = path.join(FONTS_DIR, argv[0]);
    const buf = new WrappedAsyncIterator(fontPath);

    const header = await buf.ascii();

    const isTtcf = header === 'ttcf';

    if (!isTtcf) {
      throw new Error('File header is not ttcf: ' + header);
    } else {
      console.log('we have a TTCF');
    }

    const majorVersion = await buf.uint16();

    if (majorVersion !== 2) {
      throw new Error('Only TTC version 2 is supported for now');
    }

    const minorVersion = await buf.uint16();
    const numFonts = await buf.uint32();
    const offsetTable = await buf.uint32();
    const dsigTag = await buf.uint32();
    const dsigLength = await buf.uint32();
    const dsigOffset = await buf.uint32();

    const moreShit = await Promise.all([
      buf.ascii(),
      buf.ascii(),
      buf.ascii(),
      buf.ascii(),
      buf.ascii(),
      buf.ascii(),
      buf.ascii(),
      buf.ascii(),
      buf.ascii(),
      buf.ascii(),
      buf.ascii(),
      buf.ascii(),
      buf.ascii(),
      buf.ascii(),
      buf.ascii(),
      buf.ascii(),
    ]);

    console.log({ majorVersion, minorVersion, numFonts, offsetTable, dsigTag, dsigLength, dsigOffset, moreShit });
  } catch (err) {
    console.error(err);
  } finally {
    if (fd != null) {
      fs.closeSync(fd);
    }
  }
})(process.argv.slice(2));
