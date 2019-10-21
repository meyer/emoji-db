import util from 'util';
import { unicodeJoiners, heartCodepoints, kissCodepoints, famCodepoints } from './constants';

/**
 * Print a number as a zero-padded hex string with pad lengths equal to powers of 2.
 * Minimum pad length is 4.
 */
export const numToHex = (num: number) => {
  const numStr = num.toString(16);
  const padLen = numStr.length <= 4 ? 4 : Math.pow(2, Math.ceil(Math.log2(numStr.length)));
  return `0x${numStr.padStart(padLen, '0')}`;
};

export class FormattedError extends Error {
  constructor(message: string, ...args: any[]) {
    super(util.format(message, ...args));
  }
}

export const toCodepoints = (str: string) => Array.from(str).map(s => s.codePointAt(0)!);

export const slugify = (str: string) =>
  str
    .toLowerCase()
    .replace(/['\u{2019}]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace('*', 'asterisk')
    .replace('\u0023', 'hash')
    .replace(' & ', ' and ')
    .replace(/[^\w\-]+/g, '_')
    .replace(/^_+|_+$/g, '');

// adding 1 to the index makes non-matches falsey, which lets us fall back to the giant number
const famIndex = (i: string) => 'MWGB'.indexOf(i) + 1 || 999;

export const famSort = (str: string) =>
  Array.from(str)
    .sort((a, b) => famIndex(a) - famIndex(b))
    .join('');

export const rejectJoiners = (codepoint: number) => !unicodeJoiners.includes(codepoint);

export const toFamString = (codepoints: number[]) =>
  famSort(
    codepoints
      .map(codepoint => famCodepoints[codepoint as keyof typeof famCodepoints] as string)
      .sort((a, b) => famIndex(a) - famIndex(b))
      .join('')
  );

export const toEmojiKey = (codepoints: number[]) => {
  const filtered = codepoints.filter(rejectJoiners);

  if (filtered.length === 1) {
    // special case 1: people group defaults
    if (filtered[0] === 0x1f48f) {
      // default kiss emoji"
      return 'u1F48F.MW';
    }

    if (filtered[0] === 0x1f491) {
      // default heart emoji"
      return 'u1F491.MW';
    }

    if (filtered[0] === 0x1f46a) {
      // default family emoji"
      return 'u1F46A.MWB';
    }
  } else {
    if (filtered.filter(f => !heartCodepoints.includes(f)).length === 0) {
      return `u1F491.${toFamString(filtered)}`;
    } else if (filtered.filter(f => !kissCodepoints.includes(f)).length === 0) {
      return `u1F48F.${toFamString(codepoints)}`;
    }

    if (filtered.filter(f => !famCodepoints.hasOwnProperty(f)).length === 0) {
      // fam emoji + MWBG string
      return `u1F46A.${toFamString(codepoints)}`;
    }
  }

  return filtered
    .map(
      c =>
        'u' +
        c
          .toString(16)
          .toUpperCase()
          .padStart(4, '0')
    )
    .join('_');
};

// sort an object by keys, unicode style
export const unicodeSort = <T extends Record<string, any>>(obj: T): T =>
  Object.entries(obj)
    .sort(([k1], [k2]) => parseInt(k1.split('_')[0], 16) - parseInt(k2.split('_')[0], 16))
    .reduce<T>((p, [k, v]) => ({ ...p, [k]: v }), {} as T);
