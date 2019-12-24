#!/usr/bin/env bash

rm -rf cache
mkdir -p cache
wget -O cache/annotations.xml https://raw.githubusercontent.com/unicode-org/cldr/master/common/annotations/en.xml
wget -O cache/emoji-data.txt https://unicode.org/Public/emoji/latest/emoji-data.txt
wget -O cache/emoji-sequences.txt https://unicode.org/Public/emoji/latest/emoji-sequences.txt
wget -O cache/emoji-test.txt https://unicode.org/Public/emoji/latest/emoji-test.txt
wget -O cache/emoji-variation-sequences.txt https://unicode.org/Public/emoji/latest/emoji-variation-sequences.txt
wget -O cache/emoji-zwj-sequences.txt https://unicode.org/Public/emoji/latest/emoji-zwj-sequences.txt
