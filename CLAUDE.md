# emoji-db

@README.md

## Key Files

- `src/TrueTypeFont.ts` - Parses TTF tables (sbix, cmap, post)
- `src/BinaryParser.ts` - Low-level binary reading utilities
- `src/scripts/extractEmojiImages.ts` - PNG extraction script
- `src/scripts/generateDb.ts` - Generates emoji-db.json
- `src/utils/emojiNameToKey.ts` - Converts glyph names to emoji keys
- `src/utils/getMetadataForEmojiKey.ts` - Resolves emoji metadata

## Git Workflow

- Commit after every distinct unit of work
- Amend if polishing or fixing the previous commit, but only if it hasn't been pushed to main
- Always ask before committing, pushing, or other destructive git operations

## Notes

- Internal glyphs like `hiddenglyph` are filtered out in TrueTypeFont.ts
- `flip` glyphs use sharp for horizontal mirroring
- `dupe` glyphs share file paths in manifest (no data duplication)
- `emjc` (LZFSE compressed) glyphs are logged and skipped
