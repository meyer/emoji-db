import fs from 'fs';
import path from 'path';
import { FONTS_DIR, ttfHeader, ttcfHeader, cffTtfHeader, SYSTEM_EMOJI_TTC_PATH, DATA_DIR } from '../constants';
import { BinaryParser } from '../BinaryParser';
import { getTtfFromOffset, TTFFont } from '../getTtfFromOffset';
import { numToHex } from '../utils/numToHex';
import { getSystemInfo } from '../utils/getSystemInfo';
import { invariant } from '../utils/invariant';

const versionDataPath = path.join(DATA_DIR, 'versions.json');

(async () => {
  const fh = await fs.promises.open(SYSTEM_EMOJI_TTC_PATH, 'r');
  try {
    const systemNicename = await getSystemInfo().then(data => `${data.ProductVersion} (${data.ProductBuildVersion})`);

    invariant(fs.existsSync(SYSTEM_EMOJI_TTC_PATH), 'No file at', SYSTEM_EMOJI_TTC_PATH);

    const bp = new BinaryParser(fh);

    let emojiFont: TTFFont | undefined;

    const header = await bp.uint32();

    // OpenType with CFF data
    invariant(header !== cffTtfHeader, 'Unsupported TTF header:', numToHex(header));

    // OpenType with TrueType outlines
    if (header === ttfHeader) {
      console.log('we have a TTF');
      emojiFont = await getTtfFromOffset(fh, 0);
    }

    // TrueType collection
    else if (header === ttcfHeader) {
      console.log('we have a TTC');

      const ttcVersion = await bp.uint32();

      invariant(ttcVersion === 0x00020000, 'Only TTC version 2.0 is supported for now');

      const numFonts = await bp.uint32();
      console.log('Found %o font%s', numFonts, numFonts === 1 ? '' : 's');

      const offsets: number[] = [];

      for (let i = 0; i < numFonts; i++) {
        offsets[i] = await bp.uint32();
      }

      await bp.uint32(); // dsigTag
      await bp.uint32(); // dsigLength
      await bp.uint32(); // dsigOffset

      const fonts = await Promise.all(offsets.map(offset => getTtfFromOffset(fh, offset)));

      emojiFont = fonts.find(f => f.nameTable.postScriptName === 'AppleColorEmoji');
    }

    // Unsupported
    else {
      invariant(false, 'File header is not ttcf:', numToHex(header));
    }

    invariant(emojiFont, 'Could not find a font named Apple Color Emoji');
    invariant(emojiFont.nameTable.versionString, 'emojiFont.nameTable.versionString not set!');
    invariant(emojiFont.nameTable.fontSubfamilyName, 'emojiFont.nameTable.fontSubfamilyName not set!');

    const fontVersion = emojiFont.nameTable.versionString;
    const fontDate = emojiFont.headTable.modified;
    const ttcName = `Apple Color Emoji ${fontVersion}.ttc`;
    const ttcDest = path.join(FONTS_DIR, ttcName);

    const versionData = require(versionDataPath);
    invariant(typeof versionData === 'object', 'versionData is not an object');

    versionData[fontVersion] = {
      buildDate: fontDate.toISOString(),
      macosVersions: [],
      ...versionData[fontVersion],
    };

    const versionSet = new Set(versionData[fontVersion].macosVersions);
    versionSet.add(systemNicename);
    versionData[fontVersion].macosVersions = Array.from(versionSet).sort();

    fs.writeFileSync(versionDataPath, JSON.stringify(versionData, null, 2));

    if (fs.existsSync(ttcDest)) {
      console.info('`%s` has already been copied over', ttcName);
    } else {
      fs.copyFileSync(SYSTEM_EMOJI_TTC_PATH, ttcDest);
    }
  } finally {
    fh.close();
  }
})();
