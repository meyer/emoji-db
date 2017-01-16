# EMOJI DB

## Resources

* List of all emoji with variants: http://unicode.org/cldr/utility/list-unicodeset.jsp?a=%5B%3Aemoji%3A%5D&g=emoji
* Mega inline image emoji page (warning: 30+ MB): http://unicode.org/emoji/charts-beta/full-emoji-list.html
* Data without images: http://www.unicode.org/Public/emoji/latest/emoji-data.txt
* TRAC page: http://www.unicode.org/utility/trac/browser/trunk?order=name#unicodetools/data/emoji/
* Split TTC into TTFs with DfontSplitter: https://peter.upfold.org.uk/projects/dfontsplitter

## Converting codepoints to emoji

The unicode codepoint for :sunglasses: is `1f60e`.

### Javascript
```js
String.fromCodePoint(parseInt("1f60e", 16))
```
