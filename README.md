# EMOJI DB

## Rake task breakdown:

- **extract_ttf**: Extract a usable TTF file from `/System/Library/Fonts/Apple Color Emoji.ttc`.
- **extract_images**: Extract images from the above TTF file.
- **generate_emoji_db**: Generate the main emoji JSON file.
- **build_unicode_db**: Generate file of emoji to unicode data mappings.


## Resources

* List of all emoji sans joined variants: http://unicode.org/cldr/utility/list-unicodeset.jsp?a=%5B%3Aemoji%3A%5D&g=emoji
* Mega inline image emoji page (warning: 30+ MB): http://unicode.org/emoji/charts-beta/full-emoji-list.html
* TRAC page: http://www.unicode.org/utility/trac/browser/trunk?order=name#unicodetools/data/emoji/
* OSX build numbers: https://support.apple.com/en-us/HT201260
## Converting codepoints to emoji

The unicode codepoint for :sunglasses: is `1f60e`.

### Javascript
```js
String.fromCodePoint(parseInt("1f60e", 16))
```

### Mystery of the missing `Category-Emoji.plist`

From `/System/Library/Input Methods/CharacterPalette.app/Contents/Info.plist`:

```xml
<key>Category-Emoji</key>
<dict>
  <key>CVCategoryControllerClass</key>
  <string>CVEmojiViewController</string>
  <key>CVCategoryControllerInfo</key>
  <dict>
    <key>DataSourceClass</key>
    <string>CVDataSourcePlist</string>
    <key>ViewName</key>
    <string>EmojiCategoryView</string>
  </dict>
</dict>
```

File `/System/Library/Input Methods/CharacterPalette.app/Contents/MacOS/CharacterPalette` has interesting strings re data source.
