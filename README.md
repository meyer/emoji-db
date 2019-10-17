# EMOJI DB

## Resources

- List of all emoji sans joined variants: http://unicode.org/cldr/utility/list-unicodeset.jsp?a=%5B%3Aemoji%3A%5D&g=emoji
- Mega inline image emoji page (warning: 30+ MB): http://unicode.org/emoji/charts/full-emoji-list.html
- TRAC page: http://www.unicode.org/utility/trac/browser/trunk?order=name#unicodetools/data/emoji/
- OSX build numbers: https://support.apple.com/en-us/HT201260
- latest unicode data: https://unicode.org/Public/emoji/latest/

## Converting codepoints to emoji

The unicode codepoint for :sunglasses: is `1f60e`.

### Javascript

```js
String.fromCodePoint(parseInt('1f60e', 16));
```

## Interesting links

- https://docs.microsoft.com/en-us/typography/opentype/spec/otff
- https://developer.apple.com/fonts/TrueType-Reference-Manual/
- https://github.com/foliojs/restructure
- https://github.com/deepakjois/luafontkit/blob/4832aa04f501ed1b7a3d2691022deaafac3c0d27/src/TrueTypeCollection.js
