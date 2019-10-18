// https://docs.microsoft.com/en-us/typography/opentype/spec/otff
import path from 'path';
import { getBinaryParser, BinaryParser } from './BinaryParser';

const ROOT_DIR = path.resolve(__dirname, '..');
const FONTS_DIR = path.join(ROOT_DIR, 'fonts');

process.on('uncaughtException', err => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', err => {
  console.error('Uncaught rejection:', err);
  process.exit(1);
});

/**
 * Print a number as a zero-padded hex string with pad lengths equal to powers of 2.
 * Minimum pad length is 4.
 */
const numToHex = (num: number) => {
  const numStr = num.toString(16);
  const padLen = numStr.length <= 4 ? 4 : Math.pow(2, Math.ceil(Math.log2(numStr.length)));
  return `0x${numStr.padStart(padLen, '0')}`;
};

(async argv => {
  let bp: BinaryParser | undefined;
  try {
    if (argv.length !== 1) {
      throw new Error('one arg pls');
    }

    const fontPath = path.join(FONTS_DIR, argv[0]);
    bp = await getBinaryParser(fontPath);

    const header = await bp.ascii(4);

    const isTtcf = header === 'ttcf';

    if (!isTtcf) {
      throw new Error('File header is not ttcf: ' + header);
    } else {
      console.log('we have a TTCF');
    }

    const majorVersion = await bp.uint16();
    const minorVersion = await bp.uint16();

    const version = (majorVersion << 16) + minorVersion;

    if (version !== 0x00020000) {
      throw new Error('Only TTC version 2 is supported for now');
    }

    const numFonts = await bp.uint32();

    const offsets: number[] = [];

    for (let i = 0; i < numFonts; i++) {
      offsets[i] = await bp.uint32();
    }

    const dsigTag = await bp.uint32();
    const dsigLength = await bp.uint32();
    const dsigOffset = await bp.uint32();

    console.log({
      majorVersion,
      minorVersion,
      version: numToHex(version),
      numFonts,
      offsets,
      dsigTag,
      dsigLength,
      dsigOffset,
    });

    for (const fontOffset of offsets) {
      bp.position = fontOffset;

      const sfntVersion = await bp.uint32();
      const numTables = await bp.uint16();
      const searchRange = await bp.uint16();
      const entrySelector = await bp.uint16();
      const rangeShift = await bp.uint16();

      if (sfntVersion !== 0x00010000) {
        throw new Error('sfntVersion !== 0x00010000 (got ' + sfntVersion + ')');
      }

      console.log({
        fontOffset,
        sfntVersion,
        numTables,
        searchRange,
        entrySelector,
        rangeShift,
      });

      for (let idx = 0, len = numTables; idx < len; idx++) {
        const tag = await bp.tag();
        await bp.uint32(); // checksum
        const tableOffset = await bp.uint32();
        await bp.uint32(); // len

        const oldPosition = bp.position;
        bp.position = tableOffset;

        if (tag === 'head') {
          const version = await bp.fixed(32, 16);
          const fontRevision = await bp.fixed(32, 16);
          const checksumAdjustment = await bp.uint32();
          const magicNumber = await bp.uint32();
          const flags = await bp.uint16();
          const unitsPerEm = await bp.uint16();
          const created = await bp.longdatetime();
          const modified = await bp.longdatetime();

          console.log('head table:', {
            version,
            fontRevision,
            checksumAdjustment,
            magicNumber: magicNumber.toString(16),
            flags,
            unitsPerEm,
            created,
            modified,
          });
        } else if (tag === 'name') {
          const format = await bp.uint16();
          const count = await bp.uint16();
          const stringOffset = await bp.uint16();
          const storageAreaOffset = tableOffset + stringOffset;

          if (format !== 0) {
            throw new Error('Only format 0 is supported');
          }

          console.log('name table:', { format, count, stringOffset });

          for (let idx = 0; idx < count; idx++) {
            const platformID = await bp.uint16();
            const encodingID = await bp.uint16();
            const languageID = await bp.uint16();
            const nameID = await bp.uint16();
            const length = await bp.uint16();
            const offset = await bp.uint16();
            const nameBuf = await bp.readBytes(length, storageAreaOffset + offset);
            const name = Array.from(nameBuf)
              .map(f => String.fromCharCode(f))
              .join('');

            console.log(idx + 1, { platformID, encodingID, languageID, nameID, length, offset, name });
          }
        }

        bp.position = oldPosition;

        // console.log({ tag, checksum, tableOffset, len });
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    if (bp) {
      await bp.teardown();
    }
  }
})(process.argv.slice(2));
