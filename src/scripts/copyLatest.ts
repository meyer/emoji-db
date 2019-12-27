import fs from 'fs';
import path from 'path';
import { FONTS_DIR, SYSTEM_EMOJI_TTC_PATH, DATA_DIR } from '../constants';
import { getSystemInfo } from '../utils/getSystemInfo';
import { invariant } from '../utils/invariant';
import { getFontByName } from '../utils/getFontByName';
import stringify from 'json-stable-stringify';

const versionDataPath = path.join(DATA_DIR, 'versions.json');

(async () => {
  const fh = await fs.promises.open(SYSTEM_EMOJI_TTC_PATH, 'r');
  try {
    const systemNicename = await getSystemInfo().then(data => `${data.ProductVersion} (${data.ProductBuildVersion})`);

    invariant(fs.existsSync(SYSTEM_EMOJI_TTC_PATH), 'No file at', SYSTEM_EMOJI_TTC_PATH);

    const ttf = await getFontByName(SYSTEM_EMOJI_TTC_PATH, 'AppleColorEmoji');

    invariant(ttf, 'Could not find a font named Apple Color Emoji');
    invariant(ttf.name.versionString, 'ttf.name.versionString not set!');
    invariant(ttf.name.fontSubfamilyName, 'ttf.name.fontSubfamilyName not set!');

    const fontVersion = ttf.name.versionString;
    const fontDate = ttf.head.modified;
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

    fs.writeFileSync(versionDataPath, stringify(versionData, { space: 2 }));

    if (fs.existsSync(ttcDest)) {
      console.info('`%s` has already been copied over', ttcName);
    } else {
      fs.copyFileSync(SYSTEM_EMOJI_TTC_PATH, ttcDest);
    }

    try {
      console.log('Deleting old latest symlink...');
      fs.unlinkSync(path.join(FONTS_DIR, 'latest'));
    } catch (err) {
      console.error('Error unlinking latest:', err);
    }

    try {
      console.log('Updating latest symlink...');
      fs.symlinkSync(ttcName, path.join(FONTS_DIR, 'latest'));
    } catch (err) {
      console.error('Error unlinking latest:', err);
    }
  } finally {
    fh.close();
  }
})();
