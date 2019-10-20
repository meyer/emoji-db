import fs from 'fs';
import { longTimestampOffset } from './constants';
import { FormattedError } from './utils';

export class BinaryParser {
  constructor(fh: fs.promises.FileHandle, startPosition?: number) {
    this.fh = fh;
    this.position = startPosition || 0;
  }

  private fh: fs.promises.FileHandle;
  public position: number;

  /** Get a new BinaryParser instance starting from a new position */
  public clone = (newPosition?: number) => {
    const position = newPosition == null ? this.position : newPosition;
    return new BinaryParser(this.fh, position);
  };

  /**
   * Read a number of bytes from a position.
   * It's generally better to use int/uint/ascii/fixed convenience methods.
   */
  public readBytes = async (bytes: number, position?: number): Promise<Buffer> => {
    const pos = position == null ? this.position : position;

    const result = await this.fh.read(Buffer.alloc(bytes), 0, bytes, pos);

    if (result.bytesRead !== bytes) {
      throw new FormattedError('bytesRead mismatch: %o !== %o', result.bytesRead, bytes);
    }

    // user did not provide a position, so we auto-advance
    if (position == null) {
      this.position += bytes;
    }
    return result.buffer;
  };

  public ascii = (bytes: number, position?: number) =>
    this.readBytes(bytes, position).then(buf => buf.toString('ascii'));

  public int8 = (position?: number) => this.readBytes(1, position).then(buf => buf.readInt8(0));
  public uint8 = (position?: number) => this.readBytes(1, position).then(buf => buf.readUInt8(0));

  public uint16 = (position?: number) => this.readBytes(2, position).then(buf => buf.readUInt16BE(0));
  public int16 = (position?: number) => this.readBytes(2, position).then(buf => buf.readInt16BE(0));

  public uint24 = async (position?: number) => {
    const one = await this.uint16(position);
    const two = await this.uint8(position == null ? undefined : position + 2);
    return (one << 8) + two;
  };

  public uint32 = (position?: number) => this.readBytes(4, position).then(buf => buf.readUInt32BE(0));
  public int32 = (position?: number) => this.readBytes(4, position).then(buf => buf.readInt32BE(0));

  public fixed = async (bits: 8 | 16 | 32, pointOffset: number, position?: number) => {
    const numerator = await (bits === 8
      ? this.int8(position)
      : bits === 16
      ? this.int16(position)
      : bits === 32
      ? this.int32(position)
      : null);
    if (numerator === null) {
      throw new FormattedError('Unsupported bit length: %o', bits);
    }
    const denominator = 1 << pointOffset;
    return numerator / denominator;
  };

  public fword = this.int16;
  public ufword = this.uint16;

  public f2dot14 = async (position?: number) => {
    const num = await this.uint16(position);
    const fracBits = 14;
    let decimal = num >> fracBits;
    if (decimal > 1) {
      decimal -= 4;
    }
    const numerator = num & 0x3fff;
    const denominator = 1 << fracBits;
    return decimal + numerator / denominator;
  };

  public longdatetime = async (position?: number) => {
    const buf = await this.readBytes(8, position);
    // we only read the last 32 bits
    // TODO(meyer) update this before the year 2038
    const last32Bits = buf.readUInt32BE(4);
    const unixTimestamp = (last32Bits - longTimestampOffset) * 1000;
    return new Date(unixTimestamp);
  };

  public tag = (position?: number) => this.ascii(4, position);

  public offset16 = this.uint16;
  public offset32 = this.uint32;
}
