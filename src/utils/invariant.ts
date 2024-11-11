import { format } from 'util';
// biome-ignore lint/suspicious/noExplicitAny: its ok
export function invariant(condition: any, message: string, ...args: any[]): asserts condition {
  if (!condition) {
    throw new Error(format(message, ...args));
  }
}
