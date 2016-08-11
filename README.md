# EMOJI DB

This is a quick and dirty script that takes the contents of the Unicode emoji reference page found at [unicode.org][unicode-emoji] (caution: 32MB page) and turns it into a more useful JSON file.

## Resources

* List of all emojis with variants: http://unicode.org/cldr/utility/list-unicodeset.jsp?a=%5B%3Aemoji%3A%5D&g=emoji
* Data without images: http://www.unicode.org/Public/emoji/latest/emoji-data.txt
* TRAC page: http://www.unicode.org/utility/trac/browser/trunk?order=name#unicodetools/data/emoji/

## Converting codepoints to emoji

The unicode codepoint for :sunglasses: is `1f60e`.

### Javascript
```js
String.fromCodePoint(parseInt("1f60e", 16))
```

[unicode-emoji]: http://unicode.org/emoji/charts/full-emoji-list.html
