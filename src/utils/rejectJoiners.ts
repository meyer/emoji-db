import { unicodeJoiners } from '../constants.js';

/** Filter function that removes variation selectors and ZWJ */
export const rejectJoiners = (codepoint: number) => !unicodeJoiners.includes(codepoint);
