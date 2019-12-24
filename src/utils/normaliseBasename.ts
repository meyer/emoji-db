import { genderCodepointsByInitial } from '../constants';
import { invariant } from './invariant';
export const normaliseBasename = (basename: string): string => {
  const [key, , gender] = basename.split('.');
  invariant(typeof key === 'string', 'key was not a string');
  const normalisedKey = key
    .split('_')
    .map(f => {
      const f2 = f.toUpperCase();
      if (f2.startsWith('U')) {
        return f2.slice(1);
      }
      return f2;
    })
    .join('_');
  if (typeof gender === 'string') {
    invariant(gender === 'M' || gender === 'W', 'Unexpected gender value:', gender);
    return normalisedKey + '_' + genderCodepointsByInitial[gender].toString(16);
  }
  return normalisedKey;
};
