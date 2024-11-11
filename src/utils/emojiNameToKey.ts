import { codepointShortKeys, unicodeJoiners } from '../constants';
import { invariant } from './invariant';

const emojiNameRegex = /^([u\dA-F_]+)(\.[0-6](?:[0-6])?)?(\.[MWBG]+)?$/;

export const emojiNameToKey = (name: string): string => {
  const match = name.match(emojiNameRegex);
  invariant(match, 'Invalid emoji name: `%s`', name);
  const codepointString = match[1]!.toLowerCase();
  const famString = match[3] || '';

  let fitzString = '';
  if (match[2]) {
    // slice off the initial period
    const fitzInt = Number.parseInt(match[2].slice(1), 10);
    if (fitzInt === 0 || fitzInt === 66) {
      // default, no modifier
      // fitz 66 seems intentional... it's equivalent to fitz 0 (i.e. no modifier). only present on the holding hands emoji.
    } else if (fitzInt % 11 === 0) {
      fitzString = '.' + fitzInt / 11;
    } else {
      fitzString = '.' + fitzInt;
    }
  }

  const codepoints = codepointString.split('_').map((f) => Number.parseInt(f.slice(1), 16));

  const base = codepoints
    .filter((codepoint) => !unicodeJoiners.includes(codepoint))
    .map((codepoint) => codepoint.toString(16).padStart(4, '0'))
    .join('_');

  if (base in codepointShortKeys) {
    return codepointShortKeys[base as keyof typeof codepointShortKeys] + fitzString + famString;
  }

  return base + fitzString + famString;
};
