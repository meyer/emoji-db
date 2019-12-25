import { heartCodepoints, kissCodepoints, famInitialsByCodepoint } from '../constants';
import { rejectJoiners } from './rejectJoiners';

// adding 1 to the index makes non-matches falsey, which lets us fall back to the giant number
const famIndex = (i: string) => 'MWGB'.indexOf(i) + 1 || 999;

const famSort = (str: string) =>
  Array.from(str)
    .sort((a, b) => famIndex(a) - famIndex(b))
    .join('');

const toFamString = (codepoints: number[]) =>
  famSort(
    codepoints
      .map(codepoint => famInitialsByCodepoint[codepoint as keyof typeof famInitialsByCodepoint] as string)
      .sort((a, b) => famIndex(a) - famIndex(b))
      .join('')
  );

export const toEmojiKey = (codepoints: number[]) => {
  const filtered = codepoints.filter(rejectJoiners);
  if (filtered.length === 1) {
    // special case 1: people group defaults
    if (filtered[0] === 0x1f48f) {
      // default kiss emoji"
      return '1F48F.MW';
    }
    if (filtered[0] === 0x1f491) {
      // default heart emoji"
      return '1F491.MW';
    }
    if (filtered[0] === 0x1f46a) {
      // default family emoji"
      return '1F46A.MWB';
    }
  } else {
    if (filtered.filter(f => !heartCodepoints.includes(f)).length === 0) {
      return `1F491.${toFamString(filtered)}`;
    } else if (filtered.filter(f => !kissCodepoints.includes(f)).length === 0) {
      return `1F48F.${toFamString(codepoints)}`;
    }
    if (filtered.filter(f => !famInitialsByCodepoint.hasOwnProperty(f)).length === 0) {
      // fam emoji + MWBG string
      return `1F46A.${toFamString(codepoints)}`;
    }
  }
  return filtered
    .map(c =>
      c
        .toString(16)
        .toUpperCase()
        .padStart(4, '0')
    )
    .join('_');
};
