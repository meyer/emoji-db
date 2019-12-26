export const toEmojiSortKey = (codepoints: number[]) => codepoints.map(f => f.toString(16).padStart(8, '0')).join('_');
