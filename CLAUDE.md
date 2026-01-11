# emoji-db

Extracts emoji PNGs and metadata from Apple's Color Emoji font (TTC/TTF) and generates a comprehensive JSON database.

## Quick Start

```bash
yarn install
yarn start          # Extract images + generate DB (requires font in fonts/)
```

## Scripts

| Command | Description |
|---------|-------------|
| `yarn ci` | Full pipeline: fetch data, convert, copy font, extract, generate DB |
| `yarn start` | Quick local run: extract images + generate DB |
| `yarn copy-latest` | Copy system emoji font to fonts/ directory |
| `yarn extract-images` | Extract PNGs from font to images/ |
| `yarn generate-db` | Generate emoji-db.json from font + metadata |
| `yarn fetch-data` | Download CLDR/Unicode data files |
| `yarn convert` | Convert downloaded data to JSON |
| `yarn typecheck` | Run TypeScript type checking |

## Architecture

```
Font File (TTC/TTF)
       │
       ▼
┌──────────────────┐     ┌─────────────────┐
│ getTrueTypeFonts │────▶│  TrueTypeFont   │
│   (TTC parser)   │     │  (table parser) │
└──────────────────┘     └────────┬────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
               getCmapTable  getPostTable  getEmojiIterator
               (char→glyph)  (glyph names)  (PNG extraction)
                                              │
                                              ▼
                                    ┌─────────────────┐
                                    │ extractEmoji    │
                                    │ Images.ts       │
                                    └────────┬────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              ▼              ▼              ▼
                        images/*.png   manifest.json   emoji-db.json
```

## Key Files

- `src/TrueTypeFont.ts` - Parses TTF tables (sbix, cmap, post)
- `src/BinaryParser.ts` - Low-level binary reading utilities
- `src/scripts/extractEmojiImages.ts` - Main PNG extraction script
- `src/scripts/generateDb.ts` - Generates emoji-db.json
- `src/utils/emojiNameToKey.ts` - Converts glyph names to emoji keys
- `src/utils/getMetadataForEmojiKey.ts` - Resolves emoji metadata from multiple sources

## Glyph Name Format

Apple's glyph names follow this pattern:
```
u1F468_u1F9AF.3.M.u27A1.L
│      │      │ │  │    └─ Component suffix (L/R/RA)
│      │      │ │  └────── Direction codepoint
│      │      │ └───────── Gender modifier (M/W/B/G)
│      │      └─────────── Fitzpatrick skin tone (1-5, or 11-55 for pairs)
│      └────────────────── Additional codepoints (ZWJ sequences)
└───────────────────────── Base codepoint(s)
```

## Font Tables Used

- **sbix** - Apple's bitmap emoji table (contains PNG data)
  - Supports graphic types: `png`, `flip`, `dupe`
  - `flip` - horizontally mirrored via sharp (directional emoji like 🏃➡️)
  - `dupe` - duplicate references (manifest points to same file)
  - `emjc` - LZFSE compressed (logged warning, skipped)
  - Internal glyphs like `hiddenglyph` are filtered out
- **cmap** - Character to glyph mapping (format 12)
- **post** - PostScript glyph names (v2.0.0)
- **head/maxp/name** - Font metadata

## Output Structure

```
images/
├── *.png              # Main emoji images (~3,465)
├── components/        # Composition building blocks (~126)
│   └── *.png          # Silhouettes, L/R/RA variants for multi-skin-tone emoji
└── manifest.json      # Glyph name → file path mapping
```

## Data Sources

- CLDR annotations (keywords, descriptions)
- Unicode emoji sequences (ZWJ, variation, flags)
- Apple Color Emoji font (system or copied to fonts/)

## Key Dependencies

- **sharp** - Image processing for horizontal flip transformation
- **ts-node** - TypeScript execution
- **yaml** - Parse extra-keywords.yaml
