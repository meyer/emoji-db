/** sort an object by keys, unicode style */
export const unicodeSort = <T extends Record<string, any>>(obj: T): T =>
  Object.entries(obj)
    .sort(([k1], [k2]) => parseInt(k1.split('_')[0], 16) - parseInt(k2.split('_')[0], 16))
    .reduce<T>((p, [k, v]) => ({ ...p, [k]: v }), {} as T);
