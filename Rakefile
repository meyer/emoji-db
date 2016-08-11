require 'base64'
require 'json'
require 'nokogiri'
require 'pathname'
require 'shellwords'
require 'ttfunk'

require './utils.rb'

EmojiTTF = File.expand_path('./fonts/Apple Color Emoji_0__1012b5.ttf')
EmojiPlist = '/System/Library/Input Methods/CharacterPalette.app/Contents/Resources/Category-Emoji.plist'

# WEIRD CASES
# guy kissing girl: U+1F48F
# guy kissing girl alt: U+1F469 U+200D U+2764 U+FE0F U+200D U+1F48B U+200D U+1F468
# family, MWBG: U+1F468 U+200D U+1F469 U+200D U+1F467 U+200D U+1F466
# guy playing basketball: U+26F9 U+FE0F

# variant selector FE0F seems to be option for these two
# girl playing basketball:        U+26F9 U+FE0F U+200D U+2640 U+FE0F
# girl playing basketball, Fitz4: U+26F9 U+1F3FD U+200D U+2640 U+FE0F

# EMOJI, VARIANT SELECTOR or FITZPATRICK

# Family emoji: 1f46a
FamilyCombinations = [
   'MB',  'MBB',  'MG',  'MGB',  'MGG',
   'WB',  'WBB',  'WG',  'WGB',  'WGG',
  'MMB', 'MMBB', 'MMG', 'MMGB', 'MMGG',
  'WWB', 'WWBB', 'WWG', 'WWGB', 'WWGG',
  'MWB', 'MWBB', 'MWG', 'MWGB', 'MWGG',
]

DefaultMaleGenderedEmojis = [
  '1f3c3', # runner
  '1f3c4', # surfer
  '1f3ca', # swimmer
  '1f3cb', # weight lifter
  '1f3cc', # golfer
  '1f46e', # police officer
  '1f471', # person with blond hair
  '1f473', # man with turban
  '1f477', # construction worker
  '1f482', # guardsman
  '1f575', # sleuth or spy
  '1f647', # person bowing deeply
  '1f6a3', # rowboat
  '1f6b4', # bicyclist
  '1f6b5', # mountaint bicyclist
  '1f6b6', # pedestrian
   '26f9', # person with ball
]

DefaultFemaleGenderedEmojis = [
  '1f46f', # woman with bunny ears
  '1f481', # information desk person
  '1f486', # face massage
  '1f487', # haircut
  '1f645', # face with no good gesture
  '1f646', # face with ok gesture
  '1f64b', # happy person raising one hand
  '1f64d', # person frowning
  '1f64e', # person with pouting face
]

EmojiURL = 'http://unicode.org/emoji/charts/full-emoji-list.html'
EmojiFile = './unicode.org-dump.html'
EmojiCategoryFile = Pathname.new('./fonts/emoji-palette-data.json')
EmojiImgDir = Pathname.new('./emoji-img')

# Kiss emoji: 1f48f
KissEmojiCombos = ['MM', 'WM', 'WW']

# Heart emoji: 1f491

FitzpatrickModifiers = [
  nil,
  "1f3fb",
  "1f3fc",
  "1f3fd",
  "1f3fe",
  "1f3ff",
]

SpecialCaseEmojis = {
  '1f441_1f5e8' => ["\u{1f441}", "\u{200d}", "\u{1f5e8}"],
}

def famToCodepoints(fam)
  # gender selector
  if fam === 'W' || fam === 'M'
    [
      "\u{200D}", # zero-width joiner
      {
        'W' => "\u{2642}", # female symbol emoji
        'M' => "\u{2640}", # male symbol emoji
      }[fam],
      "\u{FE0F}", # emoji variant selector
    ]
  else
    fam.split('').map do |f|
      {
        'M' => "\u{1f468}", # man emoji
        'W' => "\u{1f469}", # woman emoji
        'B' => "\u{1f467}", # boy emoji
        'G' => "\u{1f466}", # girl emoji
      }[f]
    # intersperse \u200d
    end.product(["\u200d"]).flatten(1)[0...-1]
  end
end

def generateEmojiDB(*categories)
  extra_metadata = JSON.parse(File.read('./extra-metadata.json'))

  emojilib_data = {}
  JSON.parse(File.read('./node_modules/emojilib/emojis.json')).each do |k,v|
    # skip the weirdo keys
    next unless v.class.to_s.downcase === 'hash' && v['char']

    key = emoji_to_codepoints(v['char']).join('_')
    v['keywords'] ||= []
    v['keywords'].concat "#{k}".split('_')
    v['emojilib_name'] = k

    emojilib_data[key] = v
  end

  emojiDB = {}

  emojiCategories = {
    'Code' =>        'codepoints',
    'Brow.' =>       'emoji',
    'B&W*' =>        'bw',
    'Apple' =>       'apple',
    'Googᵈ' =>       'android',
    'Twtr.' =>       'twitter',
    'Wind' =>        'windows',
    'FBM' =>         'fbm',
    'Sams.' =>       'samsung',
    'GMail' =>       'gmail',
    'DCM' =>         'docomo',
    'KDDI' =>        'kddi',
    'SB' =>          'softbank',
    'Name' =>        'name',
    'Keywords' =>    'keywords',
    'Date' =>        'year',
  }

  print 'Loading emoji HTML file... '
  doc = File.open(EmojiFile) {|d| Nokogiri::HTML(d)}
  rows = doc.xpath('//table/tr')
  puts 'Done!'

  # Make this a hash instead of an array so it can be inverted
  headings = rows.shift.css('th').map {|r| emojiCategories[r.text]}

  rows.each_with_index do |row, r_idx|
    cells = row.css('td')
    if cells.length === 0
      puts "Invalid row: #{r_idx + 1}"
      next
    end

    cell = cells[headings.index('emoji')]
    codepoints = emoji_to_codepoints(cell.text)
    rowKey = codepoints.join('_')

    puts "Emoji #{r_idx+1} of #{rows.length} (#{rowKey}): #{cells[headings.index('name')].text}"

    rowHash = {
      'emojilib_name' => nil,
      'codepoints' => [],
      'name' => nil,
      'category' => nil,
      'keywords' => [],
      'image' => nil,
    }

    cells.each_with_index do |cell, c_idx|
      heading = headings[c_idx]
      case heading
      when 'keywords' then rowHash['keywords'] = cell.text.split(/\,\s+/)
      when 'name' then rowHash['name'] = cell.text.downcase.split("\u{224A}")[0]
      when 'year' then rowHash['year'] = cell.text.gsub(/\D+/, '')
      # when 'emoji' then rowHash['code'] = cell.text
      when 'codepoints' then rowHash['codepoints'] = cell.text.downcase.scan(/[0-9a-f]+/)
      end
    end

    filename = EmojiImgDir.join("#{rowKey}-apple.png")
    rowHash['image'] = filename

    # Merge in interesting emojilib data
    if emojilib_data[rowKey]
      rowHash['emojilib_name'] = emojilib_data[rowKey]['emojilib_name'] || rowHash['emojilib_name']
      rowHash['category'] = emojilib_data[rowKey]['category'] || rowHash['category']
      rowHash['keywords'] = (emojilib_data[rowKey]['keywords'] || []) | rowHash['keywords']
    end

    # Conditionally merge in user-specified data
    if extra_metadata[rowKey] && extra_metadata[rowKey].class.to_s.downcase === 'hash'
      rowHash.merge!(extra_metadata[rowKey]) do |k, ov, nv|
        case k
        # overwrite string
        when 'name', 'emojilib_name' then nv
        # merge array
        when 'category', 'keywords' then (nv || []) | (ov || [])
        # prevent other keys from being overwritten
        else ov
        end
      end
    end

    emojiDB[rowKey] = rowHash #.sort.to_h
  end

  File.open('emoji-db.json', 'w') do |f|
    f.write(JSON.pretty_generate(emojiDB))
  end
end

task :extract_images do
  rm_rf EmojiImgDir
  mkdir_p EmojiImgDir
  # available sizes: 32, 40, 48, 64, 96, 160
  size = 160

  ttf = TTFunk::File.open(Pathname.new(EmojiTTF))

  puts ttf.name.unique_subfamily

  ttf.maximum_profile.num_glyphs.times do |glyph_id|
    bitmaps = ttf.sbix.all_bitmap_data_for(glyph_id)
    bitmap = bitmaps.detect {|b| b.ppem == size}
    next if bitmap.nil?

    ttf_name = ttf.postscript.glyph_for(glyph_id)
    codepoints, fitz, fam = /^
      # emoji code
      ([u0-9A-F_]+)
      # optional fitzpatrick modifier
      (?:\.([0-5]))?
      # Man Woman Boy Girl?
      (?:\.([MWBG]+))?
    $/ix.match(ttf_name) do |matchData|
      if matchData
        bits = matchData.to_a[1..-1]
        [
          bits[0].split('_').map {|n| n.gsub(/^u/, '').downcase},
          bits[1].to_i,
          bits[2]
        ]
      else
        nil
      end
    end

    next unless codepoints

    # puts "ttf_name: #{ttf_name}, codepoints: #{codepoints}, fitz: #{fitz}, fam: #{fam}"

    filename = "#{(codepoints + [FitzpatrickModifiers[fitz], fam]).compact.join('_')}-apple.#{bitmap.type}"
    File.write(EmojiImgDir.join(filename), bitmap.data.read)
  end

end

task :get_latest_emojis do
  system "plutil -convert json -r '#{EmojiPlist}' -o '#{EmojiCategoryFile}'"
end

task :test do
  emoji_file = File.read(EmojiCategoryFile)
  emoji = JSON.parse(emoji_file)
end

desc 'Downloads latest emoji database from Unicode.org'
task :download_emoji_index do
  if File.exist?(EmojiFile)
    puts "Unicode.org emoji index is already cached, delete '#{EmojiFile}' to re-download."
  else
    `curl #{EmojiURL} > #{EmojiFile}`
  end
end

desc 'Turns the downloaded emoji HTML file into a JSON file (no images)'
task :generate_db_no_images do; generateEmojiDB(nil); end

desc 'Turns the downloaded emoji HTML file into a JSON file'
task :generate_db do; generateEmojiDB('apple'); end
