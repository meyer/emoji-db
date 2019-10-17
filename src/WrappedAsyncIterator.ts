import fs from 'fs';

const transforms = {
  ascii: (buf: Buffer) => buf.toString('ascii'),
  int8: (buf: Buffer) => buf.readInt8(0),
  uint8: (buf: Buffer) => buf.readUInt8(0),
  uint16: (buf: Buffer) => buf.readUInt16BE(0),
  int16: (buf: Buffer) => buf.readInt16BE(0),
  // uint24
  uint32: (buf: Buffer) => buf.readUInt32BE(0),
  int32: (buf: Buffer) => buf.readInt32BE(0),
  // fixed
  // fword
  // ufword
  // f2dot14
  // longdatetime
  tag: (buf: Buffer) => buf.toString('ascii'),
  offset16: (buf: Buffer) => buf.readUInt16BE(0),
  offset32: (buf: Buffer) => buf.readUInt32BE(0),
};

type Transforms = typeof transforms;

// This is the type equivalent of Object.defineProperties
type TransformMap = {
  [K in keyof Transforms]: () => Promise<ReturnType<Transforms[K]>>;
};

export interface WrappedAsyncIterator extends TransformMap {}

export class WrappedAsyncIterator {
  constructor(fontPath: string) {
    this.readStream = fs.createReadStream(fontPath, {
      // iterate through the font file 4 bytes at a time
      highWaterMark: 4,
    });
    this.iterator = this.readStream[Symbol.asyncIterator]();

    const transformDescriptorMap: PropertyDescriptorMap = {};

    for (const key of Object.keys(transforms) as Array<keyof Transforms>) {
      const transform = transforms[key];
      transformDescriptorMap[key] = {
        enumerable: true,
        writable: false,
        configurable: false,
        value(this: WrappedAsyncIterator) {
          return this.next(transform as any);
        },
      };
    }

    Object.defineProperties(this, transformDescriptorMap);
  }

  private readStream: fs.ReadStream;
  private iterator: AsyncIterator<Buffer, null>;

  /** Number of iterations */
  public count = 0;

  private async next<T extends any>(transform: (buf: Buffer) => T): Promise<T> {
    this.count++;
    const result = await this.iterator.next();
    if (!Buffer.isBuffer(result.value)) {
      throw new Error('Received a non-buffer value: ' + result.value);
    }

    return transform(result.value);
  }

  // fetch two buffers of 4 bytes and concat them
  // private async next64Bit<T extends any>(transform: (buf: Buffer) => T): Promise<T> {
  //   this.count += 2;
  //   const chunk1 = await this.iterator.next();
  //   const chunk2 = await this.iterator.next();
  //   if (!Buffer.isBuffer(chunk1.value) || !Buffer.isBuffer(chunk2.value)) {
  //     throw new Error('Received a non-buffer value!');
  //   }
  //   const long = Buffer.concat([chunk1.value, chunk2.value]);
  //   return transform(long);
  // }
}
