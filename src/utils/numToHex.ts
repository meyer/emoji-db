/**
 * Print a number as a zero-padded hex string with pad lengths equal to powers of 2.
 * Minimum pad length is 4.
 */
export const numToHex = (num: number) => {
  const numStr = num.toString(16);
  const padLen = numStr.length <= 4 ? 4 : Math.pow(2, Math.ceil(Math.log2(numStr.length)));
  return `0x${numStr.padStart(padLen, '0')}`;
};
