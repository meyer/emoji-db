require 'base64'
require 'json'
require 'pathname'
require 'shellwords'
require 'ttfunk'
require 'set'
require 'tmpdir'

require './utils.rb'

class String
  def fam_sort
    self.split('').sort_by {|e| 'MWGB'.index(e) || -1}.join('')
  end
end

class Array
  def to_emoji_key
    self.map {|e| e.is_a?(Numeric) ? e.to_s(16).ljust(4, '0') : e.to_s}.join('_')
  end
  def to_fam_string
    self.map {|p| FamCodepoints[p]}.compact.join('').fam_sort
  end
end

PWD = Pathname.new Dir.pwd

# symlink to the latest emoji font file
EmojiFontLatest = PWD.join('fonts/emoji-latest.ttf')

# system character palette plist
EmojiPlist = '/System/Library/Input Methods/CharacterPalette.app/Contents/Resources/Category-Emoji.plist'

# JSON version of the character palette plist
EmojiCharList = PWD.join('fonts/emoji-palette-data.json')

# a mapping of emoji font versions to macOS versions
EmojiVersionDB = PWD.join('fonts/versions.json')

EmojiCategoryFile = PWD.join('./emoji-by-category.json')
EmojiDBFile = PWD.join('emoji-db.json')
EmojiImgDir = PWD.join('emoji-img')

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

# http://sourceforge.net/projects/ttf2ttc/
TTCSplitBin = PWD.join('scripts/split_ttcf.pl').to_s
TTFMergeBin = PWD.join('scripts/merge2ttcf.pl').to_s

desc "Extract the emoji TTF from the system TTC file"
task :extract_ttf do
  Dir.mktmpdir('_emoji_font_') do |tmp_dir|
    Dir.chdir tmp_dir

    puts "Copy the latest version of Apple Color Emoji to temp..."
    cp '/System/Library/Fonts/Apple Color Emoji.ttc', 'emoji_font.ttc'

    puts "Split the emoji file TTC into tables..."
    `#{TTCSplitBin.shellescape} --input-ttf=emoji_font.ttc --output-prefix=emoji_tmp &>/dev/null`

    puts "Merge emoji tables into a TTF (this will take about 20 seconds)..."
    `#{TTFMergeBin.shellescape} --output-ttf=emoji_font.ttf emoji_tmp_0.*.sdat &>/dev/null`

    # get macOS version information as a hash
    system_info = `sw_vers`.split("\n").reject(&:empty?).map {|l| l.split(':').map(&:strip)}.to_h

    puts "Add font to version database..."
    ttf = TTFunk::File.open('emoji_font.ttf')
    font_version = ttf.name.version[0]
    font_date = ttf.name.unique_subfamily[0][/(\d{4}\-\d\d\-\d\d)/]

    File.open(EmojiVersionDB, File::CREAT|File::RDWR) do |f|
      version_db = begin JSON.parse(f.read) rescue {} end
      version_db[font_version] ||= {"build_date" => font_date}
      (version_db[font_version]["macos_versions"] ||= []).push("#{system_info['ProductVersion']} (#{system_info['BuildVersion']})").uniq!

      f.rewind
      f.puts JSON.pretty_generate(version_db)
      f.flush
      f.truncate(f.pos)
    end

    ttf_name = "Apple Color Emoji #{font_version}.ttf"
    ttf_dest = PWD.join("fonts/#{ttf_name}")

    puts "Update symlink to latest font file..."
    cp 'emoji_font.ttf', ttf_dest
    rm_f EmojiFontLatest
    ln_s ttf_name, EmojiFontLatest
    Dir.chdir PWD
  end

  puts "Copy latest emoji chooser plist..."
  plist_contents = `plutil -convert json -r -o - -- "#{EmojiPlist}"`
  File.open(EmojiCharList, 'w') {|f| f.write plist_contents}
end

desc "Extract emoji images from the latest TTF file"
task :extract_images do
  rm_rf EmojiImgDir
  mkdir_p EmojiImgDir
  # available sizes: 32, 40, 48, 64, 96, 160
  size = 160

  latest_emoji_font = File.expand_path(EmojiFontLatest)

  abort 'Emoji font file does not exist!' unless File.exist?(latest_emoji_font)

  ttf = TTFunk::File.open(latest_emoji_font)

  # Available methods on ttf.name: https://github.com/prawnpdf/ttfunk/blob/master/lib/ttfunk/table/name.rb

  font_data = {
    :metadata => {
      :font_name => ttf.name.font_name,
      :font_version => ttf.name.version,
      :build_date => ttf.name.unique_subfamily,
    },
    :glyphs => {}
  }

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

    emoji_key = codepoints.map {|e| e.to_s(16).rjust(4, '0')}.join('_')
    emoji_key += "_#{fam.fam_sort}" if fam

    emoji_filename = emoji_key
    emoji_filename += '_' + fitz.to_s(16).rjust(4, '0') if fitz
    emoji_filename += "-apple.#{bitmap.type}"

    font_data[:glyphs][emoji_key] ||= {
      :codepoints => codepoints,
      :images => []
    }

    font_data[:glyphs][emoji_key][:fitz] ||= !!fitz
    font_data[:glyphs][emoji_key][:images].push(emoji_filename)

    File.write(EmojiImgDir.join(emoji_filename), bitmap.data.read)
  end

  File.write(EmojiImgDir.join('data.json'), JSON.pretty_generate(font_data))
end

desc "Generate a JSON object of emoji with paths to images"
task :generate_emoji_db do
  emoji_file_data = JSON.parse(File.read EmojiCharList)

  emojis_by_category = {}

  emoji_file_data['EmojiDataArray'].each do |group|
    next unless group['CVCategoryData']['Data']
    category = group['CVDataTitle'].gsub('EmojiCategory-', '').downcase
    emojis_by_category[category] = group['CVCategoryData']['Data'].split(',')
  end

  File.write(EmojiCategoryFile, JSON.pretty_generate(emojis_by_category))

  emoji_data = {}
  seen_keys = {}
  emojilib_data = {}

  JSON.parse(File.read('./node_modules/emojilib/emojis.json')).each do |k,v|
    # skip the weirdo keys
    next unless v.class.to_s.downcase === 'hash' && v['char']

    key = v['char']
    v['keywords'] ||= []
    v['keywords'].concat "#{k}".split('_')
    v['emojilib_name'] = k
    emojilib_data[key] = v
  end

  emojis_by_category.each do |category, emoji_list|
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
      data = {:category => category}

      if emojilib_data[e]
        # puts e, emojilib_data[e]
        data[:emojilib_name] = emojilib_data[e]['emojilib_name'] || nil
        data[:keywords] = (emojilib_data[e]['keywords'] || []) #| data['keywords']
      else
        puts e, '[no emojilib data]'
      end

      # if gender is specified, it's not the default emoji gender
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

      emoji_data[emoji_key] = Hash[data.sort]
    end
  end

  emoji_data = Hash[emoji_data.sort]

  puts "Success!"

  File.write(EmojiDBFile, JSON.pretty_generate(emoji_data))
end
