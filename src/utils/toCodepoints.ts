/** Split a string into characters and get the codepoint for each character */
export const toCodepoints = (str: string) => Array.from(str).map((s) => s.codePointAt(0)!);
