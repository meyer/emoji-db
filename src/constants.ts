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

/**
 * LONGDATETIME epoch is 1 Jan 1904 UTC.
 * this gives us the offset since the unix epoch.
 */
export const longTimestampOffset = Date.UTC(1904, 0, 1).valueOf() / -1000;
