#!/usr/bin/env bash

rm -rf cache
mkdir -p cache

wget -O cache/annotations.xml        https://raw.githubusercontent.com/unicode-org/cldr/master/common/annotations/en.xml
wget -O cache/annotationsDerived.xml https://raw.githubusercontent.com/unicode-org/cldr/master/common/annotationsDerived/en.xml
wget -O cache/emoji-sequences.txt     https://unicode.org/Public/emoji/latest/emoji-sequences.txt
wget -O cache/emoji-zwj-sequences.txt https://unicode.org/Public/emoji/latest/emoji-zwj-sequences.txt
wget -O cache/emoji-test.txt     https://unicode.org/Public/emoji/latest/emoji-test.txt
wget -O cache/emoji-ordering.txt https://unicode.org/emoji/charts/emoji-ordering.txt

# TODO: updated path for this file, or a replacement
wget -O cache/emoji-variation-sequences.txt https://unicode.org/Public/13.0.0/ucd/emoji/emoji-variation-sequences.txt
