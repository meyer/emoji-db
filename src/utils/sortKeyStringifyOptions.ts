import type stringify from 'json-stable-stringify';

export const sortKeyStringifyOptions: stringify.StableStringifyOptions = {
  space: 2,
  cmp: (a, b, _getter) => {
    const aVal = a.value;
    const bVal = b.value;
    if (
      aVal != null &&
      bVal != null &&
      typeof aVal === 'object' &&
      typeof bVal === 'object' &&
      'sortKey' in aVal &&
      'sortKey' in bVal &&
      typeof aVal.sortKey === 'string' &&
      typeof bVal.sortKey === 'string'
    ) {
      return aVal.sortKey.localeCompare(bVal.sortKey);
    }
    return a.key.localeCompare(b.key);
  },
  replacer: (key, value) => {
    if (key === 'sortKey') {
      return undefined;
    }
    return value;
  },
};
