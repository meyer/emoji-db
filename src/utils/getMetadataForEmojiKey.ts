// https://docs.microsoft.com/en-us/typography/opentype/spec/otff
import yaml from 'yaml';
import fs from 'fs';
import path from 'path';
import { ROOT_DIR } from '../constants';
import { invariant } from './invariant';
import annotationData from '../../data/annotations.json';
import derivedAnnotationData from '../../data/annotationsDerived.json';
import sequenceData from '../../data/emoji-sequences.json';
import variationSequenceData from '../../data/emoji-variation-sequences.json';
import zwjSequenceData from '../../data/emoji-zwj-sequences.json';
import emojilibData from '../../data/emojilib.json';
import { codepointsToKey } from './codepointsToKey';

const holdingHandRegex = /^(1f9d1_1f91d_1f9d1|1f46b|1f46c|1f46d)\.([1-5])([1-5])$/;
const fitzRegex = /^([u0-9a-f_]+)(\.[1-5][1-5]?)?(\.[MWBG]+)?$/;

const keywordsByEmoji: Record<string, string[] | undefined> = yaml.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'extra-keywords.yaml'), 'utf8')
);

export const getMetadataForEmojiKey = (key: string) => {
  const annotation =
    key in derivedAnnotationData
      ? derivedAnnotationData[key as keyof typeof derivedAnnotationData]
      : key in annotationData
      ? annotationData[key as keyof typeof annotationData]
      : null;

  let codepoints: number[] | null = null;
  let char: string | null = null;
  let name: string | null = null;
  const keywords: string[] = [];

  if (!annotation) {
    // The Apple Color Emoji font file contains unique images for the same skin tone pairs used left-right and right-left,
    // but the unicode CLDR derived annotation data only contains entries for right-left pairs.
    // For example, emoji `xyz` has images for `xyz.12` _and_ `xyz.21`, but annotation data only contains `xyz.21`.
    // We pull keywords from the `21` case for the `12` case. ZWJ data will provide the remaining pieces.
    const match = key.match(holdingHandRegex);
    invariant(match, 'key does not match holdingHandRegex (`%s`)', key);

    // reverse the order of the fitz modifiers
    const fallbackKey = `${match[1]}.${match[3]}${match[2]}`;
    console.log('Missing annotation for `%s`, falling back to `%s`', key, fallbackKey);

    const fallbackAnnotation = derivedAnnotationData[fallbackKey as keyof typeof derivedAnnotationData];
    invariant(fallbackAnnotation, 'Missing fallbackAnnotation for key `%s`', fallbackKey);

    if (fallbackAnnotation.keywords) keywords.push(...fallbackAnnotation.keywords);
  } else {
    codepoints = annotation.codepoints;
    name = annotation.name;
    if (annotation.keywords) keywords.push(...annotation.keywords);
    char = annotation.char;
  }

  if (key in zwjSequenceData) {
    const seq = zwjSequenceData[key as keyof typeof zwjSequenceData];
    char = seq.char;
    codepoints = seq.codepoints;
    name = seq.description;
  }

  if (key in variationSequenceData) {
    const seq = variationSequenceData[key as keyof typeof variationSequenceData];
    char = seq.char;
    codepoints = seq.codepoints;
  }

  if (key in sequenceData) {
    const seq = sequenceData[key as keyof typeof sequenceData];
    char = seq.char;
    codepoints = seq.codepoints;
    name = seq.description;
  }

  invariant(codepoints, 'key `%s` was not present in any data file', key);
  invariant(name, 'No name for %s', key);
  invariant(char, 'No emoji for %s', key);

  const keyFromCodepoints = codepointsToKey(codepoints);
  invariant(keyFromCodepoints === key, 'Key mismatch: `%s` (codepoints) !== `%s` (name)', keyFromCodepoints, key);

  const fitzMatch = key.match(fitzRegex);
  invariant(fitzMatch, 'Invalid key provided');

  const emojilibEmojiKey = fitzMatch[1] + (fitzMatch[3] || '');

  const emojilibDataItem =
    emojilibEmojiKey in emojilibData ? emojilibData[emojilibEmojiKey as keyof typeof emojilibData] : null;

  if (emojilibDataItem) {
    keywords.push(...emojilibDataItem.keywords);
  }

  const extraKeywords = keywordsByEmoji[key];
  if (extraKeywords) {
    keywords.push(...extraKeywords);
  }

  const fileName = name
    .replace('*', 'asterisk')
    .replace('#', 'hash')
    .replace(/(\w)\:\s(\w)/, '$1__$2')
    // remove "apostrophes"
    .replace(/['\u2019]/g, '')
    // https://stackoverflow.com/a/37511463
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(' & ', ' and ')
    .replace(/[^\w\-_]+/g, '_')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return { char, codepoints, keywords, name, emojilibDataItem, fileName };
};
