require 'base64'
require 'cgi'
require 'i18n'
require 'json'
require 'nokogiri'
require 'pathname'
require 'set'
require 'shellwords'
require 'tmpdir'
require 'ttfunk'
require 'yaml'

I18n.available_locales = [:en]

# useful constants
RootDir = Pathname.new Rake.application.original_dir
CacheDir = RootDir.join('cache')
DataDir = RootDir.join('private')
EmojiImgDir = RootDir.join('emoji-img')
EmojiImgDirRelative = Pathname.new('./emoji-img')
FontDir = RootDir.join('fonts')
SystemEmojiFont = Pathname.new('/System/Library/Fonts/Apple Color Emoji.ttc')
# see: http://www.unicode.org/emoji/charts/emoji-ordering.html
OrderedEmojiList = 'http://www.unicode.org/emoji/charts/emoji-ordering.txt';
ExtraKeywordsFile = RootDir.join('extra-keywords.yaml').to_s

# files to output
EmojiCategoryFile = DataDir.join('emoji-by-category.json').to_s
EmojiDBFile = RootDir.join('emoji-db.json').to_s
FontVersionFile = FontDir.join('versions.yaml').to_s
SequenceFile = DataDir.join('sequences.json').to_s
UnicodeAnnotationFile = DataDir.join('unicode-annotations.json').to_s
UnicodeDataFile = DataDir.join('unicode-data.json').to_s
TestDataFile = DataDir.join('emoji-test.json').to_s

FitzpatrickModifiers = [
  nil, # modifiers go from 1-5
  0x1f3fb,
  0x1f3fc,
  0x1f3fd,
  0x1f3fe,
  0x1f3ff,
]

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
  0x1f468,
  0x1f469,
  0x1f48b,
  0x2764,
]

HeartCodepoints = [
  0x1f468,
  0x1f469,
  0x2764,
]

UnicodeJoiners = [
  0x200d,
  0xfe0f, # emoji variation selector
  0xfe0e, # text variation selector
]

class String
  def fam_sort
    self.split('').sort_by {|char| 'MWGB'.index(char) || -1}.join('')
  end

  def to_codepoints
    self.chars.map {|char| char.unpack('U')[0]}
  end

  def slugify
    self.downcase
      .gsub(/['\u{2019}]/, '')
      .gsub(/.+/) {|s| I18n.transliterate s} # this is gross
      .gsub('*', 'asterisk')
      .gsub('\x{23}', 'hash')
      .gsub(' & ', ' and ')
      .gsub(/[^\w\-]+/, '_')
      .gsub(/^_+|_+$/, '')
  end
end

class Integer
  def comma_separate
    # thanks, stack overflow
    self.to_s.reverse.gsub(/...(?=.)/,'\&,').reverse
  end

  def to_unicode
    self.to_s(16).rjust(4, '0')
  end
end

class Array
  def int_to_hex
    self.map {|item| item.is_a?(Numeric) ? item.to_unicode : item.to_s}
  end

  def hex_to_int
    self.map {|str| str.to_i(16)}
  end

  def to_fam_string
    self.map {|codepoint| FamCodepoints[codepoint]}.compact.join('').fam_sort
  end

  def reject_joiners
    self.reject {|num| UnicodeJoiners.include?(num)}
  end

  def to_emoji_key
    codepoints = self.reject_joiners

    # special case 1: people group defaults
    if codepoints === [0x1f48f]
      # default kiss emoji"
      return '1f48f_MW'
    end

    if codepoints === [0x1f491]
      # default heart emoji"
      return '1f491_MW'
    end

    if codepoints === [0x1f46a]
      # default family emoji"
      return '1f46a_MWB'
    end

    # special case 2: kiss/heart emoji
    if codepoints.length > 1
      if (codepoints - HeartCodepoints).length === 0
        return "1f491_#{codepoints.to_fam_string}"
      elsif (codepoints - KissCodepoints).length === 0
        return "1f48f_#{codepoints.to_fam_string}"
      end
    end

    if (
        # Exclude MWBG emoji
        codepoints.length > 1 &&
        # only MWBG emoji?
        (codepoints - FamCodepoints.keys).empty?
      )

      # fam emoji + MWBG string
      [
        0x1f46a,
        codepoints.to_fam_string,
      ]
    else
      codepoints
    end.int_to_hex.join('_')
  end
end

class Hash
  def unicode_sort
    self.sort { |a, b| a[0].split('_')[0].to_i(16) <=> b[0].split('_')[0].to_i(16) }.to_h
  end

  def unicode_sort!
    self.replace(self.unicode_sort)
  end
end


task :rebuild => [:build_unicode_db, :generate_emoji_db]
task :default => [:rebuild]
