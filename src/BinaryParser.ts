import fs from 'fs';

export const getBinaryParser = async (filePath: string) => {
  const fh = await fs.promises.open(filePath, 'r');
  return new BinaryParser(fh);
};

// LONGDATETIME epoch is 1 Jan 1904 UTC
// this gives us the offset since the unix epoch
const longTimestampOffset = Date.UTC(1904, 0, 1).valueOf() / -1000;

// const f2dot14 = (num = 0, fracBits = 14) => {
//   const denominator = 1 << fracBits;
//   console.log('%o / %o', num, denominator);
//   return num / denominator;
// };

// console.log('0x7fff: got %o, expected %o', f2dot14(0x7fff), 1.999939);
// console.log('0x7000: got %o, expected %o', f2dot14(0x7000), 1.75);
// console.log('0x0001: got %o, expected %o', f2dot14(0x0001), 0.000061);
// console.log('0x0000: got %o, expected %o', f2dot14(0x0000), 0);
// console.log('0xffff: got %o, expected %o', f2dot14(0xffff), -0.000061);
// console.log('0x8000: got %o, expected %o', f2dot14(0x8000), -2);

// process.exit(1);

export class BinaryParser {
  constructor(fh: fs.promises.FileHandle) {
    this.fh = fh;
  }

  private fh: fs.promises.FileHandle;
  public position = 0;

  /**
   * Read a number of bytes from a position.
   * It's generally better to use int/uint/ascii/fixed convenience methods.
   */
  public async readBytes(bytes: number, position?: number): Promise<Buffer> {
    const pos = position == null ? this.position : position;

    const result = await this.fh.read(Buffer.alloc(bytes), 0, bytes, pos);

    // user did not provide a position, so we auto-advance
    if (position == null) {
      this.position += bytes;
    }
    return result.buffer;
  }

  public async teardown() {
    await this.fh.close();
  }

  public ascii = (bytes: number) => this.readBytes(bytes).then(buf => buf.toString('ascii'));

  public int8 = () => this.readBytes(1).then(buf => buf.readInt8(0));
  public uint8 = () => this.readBytes(1).then(buf => buf.readUInt8(0));

  public uint16 = () => this.readBytes(2).then(buf => buf.readUInt16BE(0));
  public int16 = () => this.readBytes(2).then(buf => buf.readInt16BE(0));

  public uint24 = async () => {
    const one = await this.uint16();
    const two = await this.uint8();
    return (one << 8) + two;
  };

  public uint32 = () => this.readBytes(4).then(buf => buf.readUInt32BE(0));
  public int32 = () => this.readBytes(4).then(buf => buf.readInt32BE(0));

  public fixed = async (bits: 8 | 16 | 32, pointOffset: number) => {
    const numerator = await (bits === 8 ? this.int8() : bits === 16 ? this.int16() : bits === 32 ? this.int32() : null);
    if (numerator === null) {
      throw new Error('Unsupported bit length:' + bits);
    }
    const denominator = 1 << pointOffset;
    return numerator / denominator;
  };

  public fword = this.int16;
  public ufword = this.uint16;

  public f2dot14 = () => this.fixed(16, 14);

  public longdatetime = async () => {
    const buf = await this.readBytes(8);
    // we only read the last 32 bits
    // TODO(meyer) update this before the year 2038
    const last32Bits = buf.readUInt32BE(4);
    const unixTimestamp = (last32Bits - longTimestampOffset) * 1000;
    return new Date(unixTimestamp);
  };

  public tag = () => this.ascii(4);

  public offset16 = this.uint16;
  public offset32 = this.uint32;
}
