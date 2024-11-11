import type { TrueTypeFont } from '../TrueTypeFont';
import { getTrueTypeFonts } from './getTrueTypeFonts';
import { invariant } from './invariant';

export const getFontByName = async (fontPath: string, fontName: string): Promise<TrueTypeFont> => {
  const fonts = await getTrueTypeFonts(fontPath);
  const ttf = fonts.find((f) => f.name.postScriptName === fontName);
  invariant(ttf, 'Could not find a font named `%s` in file `%s`', fontName, fontPath);
  return ttf;
};
