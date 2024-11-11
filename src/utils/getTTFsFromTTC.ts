import type fs from 'fs';
import { BinaryParser } from '../BinaryParser';
import type { TrueTypeFont } from '../TrueTypeFont';
import { TTCF_HEADER } from '../constants';
import { getTtfFromOffset } from './getTtfFromOffset';
import { invariant } from './invariant';
import { numToHex } from './numToHex';

export const getTTFsFromTTC = async (fh: fs.promises.FileHandle): Promise<TrueTypeFont[]> => {
  const bp = new BinaryParser(fh);
  const header = await bp.uint32();

  invariant(header === TTCF_HEADER, 'File is not a TTC');

  const ttcVersion = await bp.uint32();

  invariant(ttcVersion === 0x00020000, 'Only TTC version 2.0 is supported (received `%s`)', numToHex(ttcVersion));

  const numFonts = await bp.uint32();
  console.log('Found %o font%s', numFonts, numFonts === 1 ? '' : 's');

  const offsets: number[] = [];

  for (let i = 0; i < numFonts; i++) {
    offsets[i] = await bp.uint32();
  }

  const fonts = await Promise.all(offsets.map((offset) => getTtfFromOffset(fh, offset)));

  return fonts;
};
