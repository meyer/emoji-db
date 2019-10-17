// https://docs.microsoft.com/en-us/typography/opentype/spec/otff
import path from 'path';
import fs from 'fs';

const ROOT_DIR = path.resolve(__dirname, '..');
const FONTS_DIR = path.join(ROOT_DIR, 'fonts');

class WrappedAsyncIterator {
  constructor(fontPath: string) {
    this.readStream = fs.createReadStream(fontPath, { highWaterMark: 4 });
    this.iterator = this.readStream[Symbol.asyncIterator]();
  }

  private readStream: fs.ReadStream;
  private iterator: AsyncIterator<Buffer, null>;
  public count = 0;

  private async next<T>(transform: (f: Buffer) => T): Promise<T> {
    this.count++;
    const result = await this.iterator.next();

    if (!Buffer.isBuffer(result.value)) {
      throw new Error('Received a non-buffer value: ' + result.value);
    }
    return transform(result.value);
  }

  public ascii = () => this.next(toAscii);
  public uint16 = () => this.next(toUInt16);
  public uint32 = () => this.next(toUInt32);
}

const toAscii = (buf: Buffer) => buf.toString('ascii');
const toUInt16 = (buf: Buffer) => buf.readUInt16BE(0);
const toUInt32 = (buf: Buffer) => buf.readUInt32BE(0);

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
