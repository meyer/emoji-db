import fs from 'fs';

const transforms = {
  ascii: (buf: Buffer) => buf.toString('ascii'),
  uint16: (buf: Buffer) => buf.readUInt16BE(0),
  uint32: (buf: Buffer) => buf.readUInt32BE(0),
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
}
