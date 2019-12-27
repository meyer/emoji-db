import {
  heartCodepoints,
  kissCodepoints,
  famInitialsByCodepoint,
  fitzpatrickModifiers,
  genderInitialsByCodepoint,
} from '../constants';
import { rejectJoiners } from './rejectJoiners';
import { invariant } from './invariant';

// adding 1 to the index makes non-matches falsey, which lets us fall back to the giant number
const getFamIndex = (i: string) => 'MWGB'.indexOf(i) + 1 || 999 + (i.codePointAt(0) || 0);

const famSort = (a: string, b: string) => getFamIndex(a) - getFamIndex(b);

const toFamString = (codepoints: number[]) =>
  codepoints
    .map(codepoint => famInitialsByCodepoint[codepoint as keyof typeof famInitialsByCodepoint] as string)
    // .sort(famSort)
    .join('');

export const toEmojiKey = (codepointsOrig: number[]) => {
  const fitz: number[] = [];
  const fam: string[] = [];
  const remainingCodepoints: number[] = [];

  const codepoints = codepointsOrig.filter(rejectJoiners);

  if (codepoints.length !== 1) {
    if (codepoints.filter(f => !heartCodepoints.includes(f)).length === 0) {
      return `u1F491.${toFamString(codepoints)}`;
    }
    if (codepoints.filter(f => !kissCodepoints.includes(f)).length === 0) {
      return `u1F48F.${toFamString(codepoints)}`;
    }
    if (codepoints.filter(f => !famInitialsByCodepoint.hasOwnProperty(f)).length === 0) {
      // fam emoji + MWBG string
      return `u1F46A.${toFamString(codepoints)}`;
    }
  }

  if (
    codepoints.length === 2 &&
    (codepoints[0] === 0x1f46b || codepoints[0] === 0x1f46c || codepoints[0] === 0x1f46d)
  ) {
    const fitzIndex = fitzpatrickModifiers.indexOf(codepoints[1]);
    invariant(fitzIndex > 0, 'missing fitzpatrick index');

    if (codepoints[0] === 0x1f46b) {
      return `u1F469_u1F91D_u1F468.${fitzIndex}${fitzIndex}`;
    }

    if (codepoints[0] === 0x1f46c) {
      return `u1F468_u1F91D_u1F468.${fitzIndex}${fitzIndex}`;
    }

    if (codepoints[0] === 0x1f46d) {
      return `u1F469_u1F91D_u1F469.${fitzIndex}${fitzIndex}`;
    }
  }

  for (const codepoint of codepoints) {
    // valid values are 1-5
    const fitzIndex = fitzpatrickModifiers.indexOf(codepoint);
    if (fitzIndex > 0) {
      fitz.push(fitzIndex);
      continue;
    }

    if (genderInitialsByCodepoint.hasOwnProperty(codepoint)) {
      fam.push(genderInitialsByCodepoint[codepoint as 0x2640]);
      continue;
    }

    remainingCodepoints.push(codepoint);
  }

  if (remainingCodepoints.length === 0 && fitz.length === 1) {
    return `u${fitzpatrickModifiers[fitz[0]]?.toString(16).toUpperCase()}`;
  }

  return (
    remainingCodepoints
      .map(
        codepoint =>
          'u' +
          codepoint
            .toString(16)
            .toUpperCase()
            .padStart(4, '0')
      )
      .join('_') +
    (fitz.length > 0 ? '.' + fitz.join('') : '') +
    (fam.length > 0 ? '.' + fam.sort(famSort).join('') : '')
  );
};
