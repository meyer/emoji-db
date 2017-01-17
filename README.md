# EMOJI DB

Rake task breakdown:

**extract_ttf**: Extract a usable TTF file from `/System/Library/Fonts/Apple Color Emoji.ttc`.
**extract_images**: Extract images from the above TTF file.
**generate_emoji_db**: Generate the main emoji JSON file.
**build_unicode_db**: Generate file of emoji to unicode data mappings.


## Resources

* List of all emoji sans joined variants: http://unicode.org/cldr/utility/list-unicodeset.jsp?a=%5B%3Aemoji%3A%5D&g=emoji
* Mega inline image emoji page (warning: 30+ MB): http://unicode.org/emoji/charts-beta/full-emoji-list.html
* TRAC page: http://www.unicode.org/utility/trac/browser/trunk?order=name#unicodetools/data/emoji/

## Converting codepoints to emoji

The unicode codepoint for :sunglasses: is `1f60e`.

### Javascript
```js
String.fromCodePoint(parseInt("1f60e", 16))
```
