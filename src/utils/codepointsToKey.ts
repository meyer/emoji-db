import {
  codepointShortKeys,
  famInitialsByCodepoint,
  fitzpatrickModifiers,
  genderInitialsByCodepoint,
  heartCodepoints,
  kissCodepoints,
} from '../constants.js';
import { rejectJoiners } from './rejectJoiners.js';

// adding 1 to the index makes non-matches falsey, which lets us fall back to the giant number
const getFamIndex = (i: string) => 'MWGB'.indexOf(i) + 1 || 999 + (i.codePointAt(0) || 0);

const famSort = (a: string, b: string) => getFamIndex(a) - getFamIndex(b);

const toFamString = (codepoints: number[]) =>
  codepoints
    .map((codepoint) => famInitialsByCodepoint[codepoint as keyof typeof famInitialsByCodepoint] as string)
    .join('');

export const codepointsToKey = (codepointsOrig: number[]) => {
  const codepoints = codepointsOrig.filter(rejectJoiners);

  if (codepoints.length !== 1) {
    if (codepoints.filter((f) => !heartCodepoints.includes(f)).length === 0) {
      return `1f491.${toFamString(codepoints)}`;
    }
    if (codepoints.filter((f) => !kissCodepoints.includes(f)).length === 0) {
      return `1f48f.${toFamString(codepoints)}`;
    }
    if (codepoints.filter((f) => !(f in famInitialsByCodepoint)).length === 0) {
      return `1f46a.${toFamString(codepoints)}`;
    }
  } else if (codepoints[0] && fitzpatrickModifiers.includes(codepoints[0])) {
    return codepoints[0].toString(16);
  }

  const fitzIndeces: number[] = [];
  const fam: string[] = [];
  const remainingCodepoints: number[] = [];

  for (const codepoint of codepoints) {
    // valid values are 1-5
    const fitzIndex = fitzpatrickModifiers.indexOf(codepoint);
    if (fitzIndex > 0) {
      if (!fitzIndeces.includes(fitzIndex)) {
        fitzIndeces.push(fitzIndex);
      }
      continue;
    }

    if (genderInitialsByCodepoint.hasOwnProperty(codepoint)) {
      fam.push(genderInitialsByCodepoint[codepoint as 0x2640]);
      continue;
    }

    remainingCodepoints.push(codepoint);
  }

  const fitzString = fitzIndeces.length > 0 ? '.' + fitzIndeces.join('') : '';
  const famString = fam.length > 0 ? '.' + fam.sort(famSort).join('') : '';

  const base = remainingCodepoints.map((codepoint) => codepoint.toString(16).padStart(4, '0')).join('_');

  if (base in codepointShortKeys) {
    return codepointShortKeys[base as keyof typeof codepointShortKeys] + fitzString + famString;
  }

  return base + fitzString + famString;
};
