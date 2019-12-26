import * as stringify from 'json-stable-stringify';

export const sortKeyStringifyOptions: stringify.Options = {
  space: 2,
  cmp: (a, b) => {
    if (a.value.sortKey) {
      return a.value.sortKey.localeCompare(b.value.sortKey);
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
