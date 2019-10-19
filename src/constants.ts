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
