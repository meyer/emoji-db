/** Split a string into characters and get the codepoint for each character */
export const toCodepoints = (str: string) =>
  Array.from(str).map(
    (s) =>
      // biome-ignore lint/style/noNonNullAssertion: we always have a value here
      s.codePointAt(0)!
  );
