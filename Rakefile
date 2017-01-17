require 'base64'
require 'json'
require 'nokogiri'
require 'pathname'
require 'set'
require 'shellwords'
require 'tmpdir'
require 'ttfunk'
require 'uri'
require 'yaml'

require './utils.rb'

PWD = Pathname.new Dir.pwd
RootDir = Pathname.new Rake.application.original_dir

# symlink to the latest emoji font file
EmojiFontLatest = RootDir.join('fonts/emoji-latest.ttf')

# system character palette plist
EmojiPlist = '/System/Library/Input Methods/CharacterPalette.app/Contents/Resources/Category-Emoji.plist'

EmojiImgDir = RootDir.join('emoji-img')

ExtraMetadataFile = RootDir.join('extra-metadata.yaml').to_s

# files to output
EmojiCategoryFile = RootDir.join('emoji-by-category.json').to_s
EmojiDBFile = RootDir.join('emoji-db.json').to_s
EmojiPaletteDataFile = RootDir.join('fonts/emoji-palette-data.json')
EmojiVersionFile = RootDir.join('fonts/versions.json')
FontDataFile = RootDir.join('font-data.json').to_s
UnicodeDataFile = RootDir.join('unicode-data.json').to_s

# emoji minus ASCII numbers
EmojiQuery = '[:emoji:] - \p{Block=Basic Latin}'
EmojiListPage = "http://unicode.org/cldr/utility/list-unicodeset.jsp?a=#{URI.escape EmojiQuery}&g=emoji"
EmojiListPageCache = RootDir.join('emoji-list-page.html').to_s

# http://sourceforge.net/projects/ttf2ttc
TTCSplitBin = RootDir.join('scripts/split_ttcf.pl').to_s
TTFMergeBin = RootDir.join('scripts/merge2ttcf.pl').to_s

desc "Extract the emoji TTF from the system TTC file"
task :extract_ttf do
  Dir.mktmpdir('_emoji_font_') do |tmp_dir|
    Dir.chdir tmp_dir

    puts "Copy the latest version of Apple Color Emoji to temp..."
    cp '/System/Library/Fonts/Apple Color Emoji.ttc', 'emoji_font.ttc'

    puts "Split the emoji file TTC into tables..."
    `#{TTCSplitBin.shellescape} --input-ttf=emoji_font.ttc --output-prefix=emoji_tmp &>/dev/null`

    puts "Merge emoji tables into a TTF (this will take a while)..."
    `#{TTFMergeBin.shellescape} --output-ttf=emoji_font.ttf emoji_tmp_0.*.sdat &>/dev/null`

    # get macOS version information as a hash
    system_info = `sw_vers`.split("\n").reject(&:empty?).map {|l| l.split(':').map(&:strip)}.to_h

    puts "Add font to version database..."
    ttf = TTFunk::File.open('emoji_font.ttf')
    font_version = ttf.name.version[0]
    font_date = ttf.name.unique_subfamily[0][/(\d{4}\-\d\d\-\d\d)/]

    File.open(EmojiVersionFile, File::CREAT|File::RDWR) do |f|
      version_db = begin JSON.parse(f.read) rescue {} end
      version_db[font_version] ||= {"build_date" => font_date}
      (version_db[font_version]["macos_versions"] ||= []).push("#{system_info['ProductVersion']} (#{system_info['BuildVersion']})").uniq!

      f.rewind
      f.puts JSON.pretty_generate(version_db)
      f.flush
      f.truncate(f.pos)
    end

    font_name = "Apple Color Emoji #{font_version}"

    puts "Update symlink to latest font file..."
    cp 'emoji_font.ttf', PWD.join("fonts/#{font_name}.ttf")
    cp 'emoji_font.ttc', PWD.join("fonts/#{font_name}.ttc")
    rm_f EmojiFontLatest
    ln_s "#{font_name}.ttf", EmojiFontLatest
    Dir.chdir PWD
  end

  puts "Copy latest emoji character palette plist..."
  # -o -   output to stdout
  # -r     pretty print JSON
  plist_contents = `plutil -convert json -r -o - -- "#{EmojiPlist}"`.strip
  File.open(EmojiPaletteDataFile, 'w') {|f| f.puts plist_contents}
end

desc "Extract emoji images from the latest TTF file"
task :extract_images do
  rm_rf EmojiImgDir
  mkdir_p EmojiImgDir
  # available sizes: 32, 40, 48, 64, 96, 160
  size = 160

  latest_emoji_font = File.expand_path(EmojiFontLatest)

  abort 'Emoji font file symlink does not exist!' unless File.symlink?(EmojiFontLatest)
  abort 'Emoji font file does not exist!' unless File.exist?(latest_emoji_font)

  ttf = TTFunk::File.open(latest_emoji_font)

  # Available methods on ttf.name: https://github.com/prawnpdf/ttfunk/blob/master/lib/ttfunk/table/name.rb

  font_data = {
    :metadata => {
      :font_name => ttf.name.font_name[0],
      :font_version => ttf.name.version[0],
      :build_date => ttf.name.unique_subfamily[0][/(\d{4}\-\d\d\-\d\d)/],
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

    emoji_key = codepoints.int_to_unicode.join('_')
    emoji_key += "_#{fam.fam_sort}" if fam

    emoji_filename = emoji_key
    emoji_filename += '_' + fitz.to_s(16).rjust(4, '0') if fitz
    emoji_filename += '.' + bitmap.type

    font_data[:glyphs][emoji_key] ||= {
      :codepoints => codepoints,
      :images => []
    }

    font_data[:glyphs][emoji_key][:fitz] ||= !!fitz
    font_data[:glyphs][emoji_key][:images].push(emoji_filename)

    File.write(EmojiImgDir.join(emoji_filename), bitmap.data.read)
  end

  File.open(FontDataFile, 'w') {|f| f.puts JSON.pretty_generate(font_data)}
end

desc "Generate a JSON object of emoji with paths to images"
task :generate_emoji_db do
  emoji_file_data = JSON.parse(File.read EmojiPaletteDataFile)
  extra_metadata = YAML.load(File.read ExtraMetadataFile)
  unicode_data = JSON.parse(File.read UnicodeDataFile)
  font_data = JSON.parse(File.read FontDataFile)

  emoji_by_category = {}

  emoji_file_data['EmojiDataArray'].each do |group|
    next unless group['CVCategoryData']['Data']
    category = group['CVDataTitle'].gsub('EmojiCategory-', '').downcase
    emoji_by_category[category] = group['CVCategoryData']['Data'].split(',')
  end

  File.write(EmojiCategoryFile, JSON.pretty_generate(emoji_by_category))

  emoji_data = {}
  emojilib_data = {}

  JSON.parse(File.read('./node_modules/emojilib/emojis.json')).each do |k,v|
    # skip the weirdo keys
    next unless v.class.to_s.downcase === 'hash' && v['char']

    codepoints = v['char'].to_codepoints.reject_joiners
    v['keywords'] ||= []
    v['keywords'].concat "#{k}".split('_')
    v['emojilib_name'] = k
    emojilib_data[codepoints.to_emoji_key] = v
  end

  emoji_by_category.each do |category, emoji_list|
    emoji_list.map do |e|
      emoji_codepoints = e.to_codepoints
      key_codepoints = emoji_codepoints.reject_joiners

      gender = if GenderCodepoints.keys.include?(key_codepoints[-1])
        GenderCodepoints[key_codepoints.pop]
      else
        nil
      end

      uni = unicode_data['emoji'][e]

      emoji_key = key_codepoints.to_emoji_key
      data = emoji_data[emoji_key] || {
        emojilib_name: nil,
        codepoints: [],
        codepoints_string: [],
        name: nil,
        category: category,
        unicode_category: nil,
        unicode_subcategory: nil,
        keywords: [],
        emoji: nil,
        image: nil,
        year: nil,
        fitz: false,
      }

      if extra_metadata[emoji_key]
        # ensure keys are symbols
        data.merge!(extra_metadata[emoji_key].map {|k,v| [k.to_sym, v]}.to_h)
      end

      if uni
        data[:name] ||= uni['description'].downcase
        data[:unicode_category] = unicode_data['categories'][uni['category']]
        data[:unicode_subcategory] = unicode_data['subcategories'][uni['subcategory']]
      end

      if emojilib_data[emoji_key]
        # puts e, emojilib_data[e]
        data[:emojilib_name] = emojilib_data[emoji_key]['emojilib_name'] || nil
        data[:keywords] = (emojilib_data[emoji_key]['keywords'] || []) | data[:keywords]
      else
        # puts e + ' -- [no emojilib data] ' + key_codepoints.pack('U*') + ' -- [' + key_codepoints.join(',') + ']'
      end

      # if gender is specified, it's not the default emoji gender
      if gender
        default_gender = 'WM'.gsub(gender, '')

        data.merge!({
          :image => "./emoji-img/#{emoji_key}_#{default_gender}.png",
          :image_alt => "./emoji-img/#{emoji_key}_#{gender}.png",
          :default_gender => default_gender,
          :codepoints_alt => emoji_codepoints,
          :codepoints_alt_string => emoji_codepoints.int_to_unicode,
          :emoji_alt => e,
        })

        data[:fitz] ||= File.exist?(RootDir.join "./emoji-img/#{emoji_key}_#{gender}_1f3fb.png") && [
          "./emoji-img/#{emoji_key}_#{gender}_1f3fb.png",
          "./emoji-img/#{emoji_key}_#{gender}_1f3fc.png",
          "./emoji-img/#{emoji_key}_#{gender}_1f3fd.png",
          "./emoji-img/#{emoji_key}_#{gender}_1f3fe.png",
          "./emoji-img/#{emoji_key}_#{gender}_1f3ff.png",
        ]

      elsif data[:default_gender]
        data.merge!({
          :emoji => e,
          :codepoints => emoji_codepoints,
          :codepoints_string => emoji_codepoints.int_to_unicode,
        })
      else
        data.merge!({
          :emoji => e,
          :codepoints => emoji_codepoints,
          :codepoints_string => emoji_codepoints.int_to_unicode,
          :image => "./emoji-img/#{emoji_key}.png",
        })

        data[:fitz] ||= File.exist?(RootDir.join "./emoji-img/#{emoji_key}_1f3fb.png") && [
          "./emoji-img/#{emoji_key}_1f3fb.png",
          "./emoji-img/#{emoji_key}_1f3fc.png",
          "./emoji-img/#{emoji_key}_1f3fd.png",
          "./emoji-img/#{emoji_key}_1f3fe.png",
          "./emoji-img/#{emoji_key}_1f3ff.png",
        ]
      end

      emoji_data[emoji_key] = data
    end
  end

  errors = []
  emoji_data.each do |k,v|
    if !File.exist?(RootDir.join v[:image])
      errors.push "#{v[:emoji]} does not exist at #{v[:image]}"
    end
    if v[:image_alt] && !File.exist?(RootDir.join v[:image_alt])
      errors.push"#{v[:emoji]} (alt) does not exist at #{v[:image_alt]}"
    end
  end

  if errors.length > 0
    puts "#{errors.length} error#{errors.length === 1 ? '' : 's'} encountered!"
    abort errors.map {|r| "- #{r}"}.join("\n")
  end

  # emoji_data = Hash[emoji_data.sort]

  puts "Emoji database updated! Size: #{emoji_data.keys.length.comma_separate} emoji, not including variants"

  File.write(EmojiDBFile, JSON.pretty_generate(emoji_data))
end

task :build_unicode_db do
  if File.exist?(EmojiListPageCache)
    puts "EmojiListPage is already cached, delete '#{File.basename EmojiListPageCache}' to re-download."
  else
    `curl #{EmojiListPage.shellescape} > #{EmojiListPageCache.shellescape}`
  end
  doc = File.open(EmojiListPageCache) {|d| Nokogiri::HTML(d)}
  rows = doc.xpath('//blockquote/table/tr')
  puts "rows: #{rows.length}"

  categories = []
  subcategories = []

  unicode_db = {
    categories: [],
    subcategories: [],
    emoji: {},
  }

  current_category = nil
  current_subcategory = nil

  rows.each_with_index do |row, idx|
    cells = row.css('td')
    next if cells.length === 0
    if cells.length === 1
      cat, subcat = cells[0].css('a').map(&:text)

      cat_index = categories.index(cat)
      subcat_index = subcategories.index(subcat)

      if !cat_index
        categories.push(cat)
        cat_index = categories.length - 1
      end

      if !subcat_index
        subcategories.push(subcat)
        subcat_index = subcategories.length - 1
      end

      current_category = cat_index
      current_subcategory = subcat_index
    elsif cells.length === 3
      # :space: catches \u00a0 and friends
      emoji = cells[0].text.strip.gsub(/[[:space:]]/, '')
      unicode_db[:emoji][emoji] = {
        :codepoints => emoji.to_codepoints,
        :description => cells[2].text.strip,
        :category => current_category,
        :subcategory => current_subcategory,
      }
    end
  end

  unicode_db[:categories] = categories
  unicode_db[:subcategories] = subcategories

  File.open(UnicodeDataFile, 'w') {|f| f.puts JSON.pretty_generate(unicode_db)}
end

task :rebuild => [:extract_images, :build_unicode_db, :generate_emoji_db]
task :default => [:extract_ttf, :rebuild]
