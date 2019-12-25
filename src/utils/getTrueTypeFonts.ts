import fs from 'fs';
import { invariant } from './invariant';
import { TrueTypeFont } from '../TrueTypeFont';
import { getTTFsFromTTC } from './getTTFsFromTTC';
import { BinaryParser } from '../BinaryParser';
import { CFF_TTF_HEADER, TTF_HEADER, TTCF_HEADER } from '../constants';
import { getTtfFromOffset } from './getTtfFromOffset';
import { numToHex } from './numToHex';

export const getTrueTypeFonts = async (fontPath: string): Promise<TrueTypeFont[]> => {
  invariant(fs.existsSync(fontPath), 'No file at the following location: `%s`', fontPath);
  const fh = await fs.promises.open(fontPath, 'r');
  const bp = new BinaryParser(fh);
  const header = await bp.uint32();

  // OpenType with CFF data
  invariant(header !== CFF_TTF_HEADER, 'OpenType with CFF data is not supported');

  // OpenType with TrueType outlines
  if (header === TTF_HEADER) {
    console.log('we have a TTF');
    const ttf = await getTtfFromOffset(fh, 0);
    return [ttf];
  }

  // TrueType collection
  else if (header === TTCF_HEADER) {
    return getTTFsFromTTC(fh);
  }

  throw new Error('File header is not ttcf: `' + numToHex(header) + '`');
};
