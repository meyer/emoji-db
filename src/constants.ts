// https://docs.microsoft.com/en-us/typography/opentype/spec/name#name-ids
export const nameIds = [
  'copyrightNotice',
  'fontFamilyName',
  'fontSubfamilyName',
  'uniqueFontIdentifier',
  'fullFontName',
  'versionString',
  'postScriptName',
  'trademark',
  'manufacturerName',
  'designer',
  'description',
  'urlVendor',
  'urlDesigner',
  'licenseDescription',
  'licenseInfoUrl',
  null, // reserved
  'typographicFamilyName',
  'typographicSubfamilyName',
  'compatibleFull',
  'sampleText',
  'postScriptCIDFindfontName',
  'wwsFamilyName',
  'wwsSubfamilyName',
  'lightBackgroundPalette',
  'darkBackgroundPalette',
  'variationsPostScriptNamePrefix',
] as const;

export type NameIdKey = Extract<(typeof nameIds)[number], string>;

export const ttcfHeader = Buffer.from('ttcf').readUInt32BE(0);
export const ttfHeader = 0x00010000;
export const cffTtfHeader = 0x4f54544f;

/**
 * LONGDATETIME epoch is 1 Jan 1904 UTC.
 * this gives us the offset since the unix epoch.
 */
export const longTimestampOffset = Date.UTC(1904, 0, 1).valueOf() / -1000;

export const fitzpatrickModifiers = [
  null, // modifiers go from 1-5
  0x1f3fb,
  0x1f3fc,
  0x1f3fd,
  0x1f3fe,
  0x1f3ff,
];

export const famCodepoints = {
  0x1f466: 'B', // boy emoji
  0x1f467: 'G', // girl emoji
  0x1f468: 'M', // man emoji
  0x1f469: 'W', // woman emoji
};

export const genderCodepoints = {
  0x02640: 'W',
  0x02642: 'M',
};

export const kissCodepoints = [0x1f468, 0x1f469, 0x1f48b, 0x2764];

export const heartCodepoints = [0x1f468, 0x1f469, 0x2764];

export const unicodeJoiners = [
  0x200d,
  0xfe0f, // emoji variation selector
  0xfe0e, // text variation selector
];
