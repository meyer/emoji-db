require 'base64'
require 'json'
require 'pathname'
require 'shellwords'
require 'ttfunk'
require 'set'

require './utils.rb'

class String
  def fam_sort
    self.split('').sort_by {|e| 'MWGB'.index(e) || -1}.join('')
  end
end

class Array
  def to_emoji_key
    self.map {|e| e.is_a?(Numeric) ? e.to_s(16) : e.to_s}.join('_')
  end
  def to_fam_string
    self.map {|p| FamCodepoints[p]}.compact.join('').fam_sort
  end
end

EmojiTTF = File.expand_path('./fonts/emoji-latest.ttf')
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

# Family: 1f46a
# Couple: 1f491
# Kissing: 1f48f

FamCP = 0x1f46a
CoupleCP = 0x1f491
KissingCP = 0x1f48f

def is_fam(cp)
end

def is_couple(cp)
end

def is_smoochin(cp)
end

FamilyCombinations = Set[
   'MB',  'MBB',  'MG',  'MGB',  'MGG',
   'WB',  'WBB',  'WG',  'WGB',  'WGG',
  'MMB', 'MMBB', 'MMG', 'MMGB', 'MMGG',
  'WWB', 'WWBB', 'WWG', 'WWGB', 'WWGG',
  'MWB', 'MWBB', 'MWG', 'MWGB', 'MWGG',
]

EmojiURL = 'http://unicode.org/emoji/charts/full-emoji-list.html'
EmojiCategoryFile = Pathname.new('./emoji-by-category.json')
EmojiImgDir = Pathname.new('./emoji-img')

# Kiss emoji: 1f48f
KissEmojiCombos = ['MM', 'WM', 'WW']

# Heart emoji: 1f491

FitzpatrickModifiers = [
  nil,
  0x1f3fb,
  0x1f3fc,
  0x1f3fd,
  0x1f3fe,
  0x1f3ff,
]

# 1f469 1f469 1f466
# 1f468 1f469 1f466 1f466
FamCodepoints = {
  0x1f466 => 'B', # boy emoji
  0x1f467 => 'G', # girl emoji
  0x1f468 => 'M', # man emoji
  0x1f469 => 'W', # woman emoji
}

GenderCodepoints = {
  0x02640 => 'W',
  0x02642 => 'M',
}

KissCodepoints = [
  0x1f48f, # default couple kiss emoji
  0x02764, # heart
  0x1f48b, # kiss
  0x1f468, # man
  0x1f469, # woman
]

HeartCodepoints = [
  0x1f491, # default couple heart emoji
  0x02764, # heart
  0x1f468, # man
  0x1f469, # woman
]

# Array intersperse: [].product(["thing"]).flatten(1)[0...-1]

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
          bits[0].split('_').map {|n| n.gsub(/^u/, '').to_i(16)},
          FitzpatrickModifiers[bits[1].to_i],
          bits[2]
        ]
      else
        nil
      end
    end

    next unless codepoints

    emoji_filename = (codepoints + [fitz]).compact.map {|e| e.to_s(16).rjust(4, '0')}.join('_')
    emoji_filename += "_#{fam.fam_sort}" if fam
    emoji_filename += "-apple"
    emoji_filename += ".#{bitmap.type}"

    puts "ttf_name: #{ttf_name}, codepoints: #{codepoints}, fitz: #{fitz}, fam: #{fam}"

    File.write(EmojiImgDir.join(emoji_filename), bitmap.data.read)
  end

end

task :get_latest_emojis do
  # if File.exist?(EmojiCategoryFile)
  #   puts "Emoji file already exists at '#{EmojiCategoryFile}', delete to re-extract"
  #   return
  # end

  file_data = `plutil -convert json -r -o - -- '#{EmojiPlist}'`
  emoji_file_data = JSON.parse(file_data)

  emojis_by_category = {}

  emoji_file_data['EmojiDataArray'].each do |group|
    next unless group['CVCategoryData']['Data']
    category = group['CVDataTitle'].gsub('EmojiCategory-', '').downcase
    emojis_by_category[category] = group['CVCategoryData']['Data'].split(',')
  end

  File.write(EmojiCategoryFile, JSON.pretty_generate(emojis_by_category))
end

emoji_by_codepoints = {}
gendered_emoji = {}

def codepoints_to_filename(cp_array)
  cp_array.join('_')
end

task :test => [:get_latest_emojis] do
  emoji_file = File.read(EmojiCategoryFile)
  emoji_file_data = JSON.parse(emoji_file)

  emoji_data = {}
  seen_keys = {}

  emoji_file_data.each do |category, emoji_list|
    emoji_list.map do |e|
      emoji_codepoints = emoji_to_codepoints(e)
      key_codepoints = emoji_codepoints.reject {|c| [0x200d, 0xfe0f].include?(c)}

      gender = nil
      common_key = nil

      if GenderCodepoints.keys.include?(key_codepoints[-1])
        gender = GenderCodepoints[key_codepoints.pop]
      end

      if (
          # Exclude MWBG emoji
          key_codepoints.length > 1 &&
          # only MWBG emoji?
          (key_codepoints - FamCodepoints.keys).empty?
        )

        # fam emoji
        common_key = [0x1f46a].to_emoji_key

        # fam emoji + MWBG string
        emoji_key = [
          0x1f46a,
          key_codepoints.to_fam_string
        ].to_emoji_key
      else
        emoji_key = common_key = key_codepoints.to_emoji_key
      end

      (seen_keys[common_key] ||= []).push(emoji_key)

      emoji_filepath = EmojiImgDir.join("#{emoji_key}.png")
      data = {}

      if gender
        default_gender = 'WM'.gsub(gender, '')

        data.merge!({
          :filepath => EmojiImgDir.join("#{emoji_key}_#{default_gender}.png"),
          :filepath_alt => EmojiImgDir.join("#{emoji_key}_#{gender}.png"),
          :default_gender => default_gender,
          :codepoints_alt => emoji_codepoints,
          :emoji_alt => e,
        })
        data[:exists] = File.exist?(data[:filepath])
        data[:exists_alt] = File.exist?(data[:filepath_alt])
      elsif data[:default_gender]
        data.merge!({
          :emoji => e,
          :codepoints => emoji_codepoints,
        })
      else
        data.merge!({
          :emoji => e,
          :codepoints => emoji_codepoints,
          :codepoints_string => emoji_codepoints.map {|c| c.to_s(16).ljust(4, '0')},
          :filepath => emoji_filepath,
          :exists => File.exist?(emoji_filepath),
        })
      end

      fitz = nil
      data[:fitz] = true if fitz

      # next if File.exist?(data[:filepath])

      emoji_data[emoji_key] = Hash[data.sort]

      # emoji_filename = codepoints_to_filename(emoji_codepoints)

      # next unless File.exist?(emoji_filepath)

      # puts "#{emoji_key} || #{e} -- #{emoji_filepath} (exists: #{File.exist?(emoji_filepath)})"
    end
  end

  puts JSON.pretty_generate(emoji_data)
end
