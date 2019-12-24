import { format } from 'util';
export function invariant(condition: any, message: string, ...args: any[]): asserts condition {
  if (!condition) {
    throw new Error(format(message, ...args));
  }
}
