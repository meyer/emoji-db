import { codepointShortKeys, unicodeJoiners } from '../constants.js';
import { invariant } from './invariant.js';

// Parses emoji glyph names with these components:
// - Base codepoints: u1F600, u1F468_u1F9AF
// - Fitzpatrick skin tone: .0-.5 or .11-.55 (double digits for pairs)
// - Gender modifiers: .M, .W, .B, .G or combinations
// - Direction codepoints: .u27A1 (rightward arrow), .u2B05 (leftward arrow)
// - Component suffixes: .L, .R, .RA (silhouettes/composition pieces)
const emojiNameRegex = /^([u\dA-F_]+)(\.[0-6](?:[0-6])?)?(\.[MWBG]+)?(\.u[0-9A-F]+)?(\.(?:L|R|RA))?$/i;

export const emojiNameToKey = (name: string): string => {
  const match = name.match(emojiNameRegex);
  invariant(match?.[1], 'Invalid emoji name: `%s`', name);
  const codepointString = match[1].toLowerCase();
  const famString = match[3] || '';
  const directionCodepoint = match[4] || ''; // e.g., .u27A1
  const componentSuffix = match[5] || ''; // e.g., .L, .R, .RA

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

  // If there's a direction codepoint (e.g., .u27A1), add it to the codepoints
  if (directionCodepoint) {
    const dirCodepoint = Number.parseInt(directionCodepoint.slice(2), 16); // slice off ".u"
    codepoints.push(dirCodepoint);
  }

  const base = codepoints
    .filter((codepoint) => !unicodeJoiners.includes(codepoint))
    .map((codepoint) => codepoint.toString(16).padStart(4, '0'))
    .join('_');

  if (base in codepointShortKeys) {
    return codepointShortKeys[base as keyof typeof codepointShortKeys] + fitzString + famString + componentSuffix;
  }

  return base + fitzString + famString + componentSuffix;
};
