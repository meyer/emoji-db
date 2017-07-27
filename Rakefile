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
EmojiPlist = Pathname.new '/System/Library/Input Methods/CharacterPalette.app/Contents/Resources/Category-Emoji.plist'
SystemInfoPlist = Pathname.new '/System/Library/CoreServices/SystemVersion.plist'
EmojiFont = Pathname.new '/System/Library/Fonts/Apple Color Emoji.ttc'

EmojiImgDir = RootDir.join('emoji-img')
EmojiImgDirRelative = Pathname.new('./emoji-img')

ExtraMetadataFile = RootDir.join('extra-metadata.yaml').to_s
DataDir = RootDir.join('data')
FontDir = RootDir.join('fonts')
CacheDir = RootDir.join('cache')

# files to output
EmojiDBFile = RootDir.join('emoji-db.json').to_s
FontPaletteDataFile = FontDir.join('palette-data.json').to_s
FontVersionFile = FontDir.join('versions.json').to_s
FontDataFile = FontDir.join('font-data.json').to_s
EmojiCategoryFile = DataDir.join('emoji-by-category.json').to_s
UnicodeDataFile = DataDir.join('unicode-data.json').to_s
UnicodeAnnotationFile = DataDir.join('unicode-annotations.json').to_s

# emoji minus ASCII numbers
EmojiQuery = '[:emoji:] - \p{Block=Basic Latin}'
EmojiListURL = "http://unicode.org/cldr/utility/list-unicodeset.jsp?a=#{URI.escape EmojiQuery}&g=emoji"
EmojiListURLCache = CacheDir.join('emoji-list-page.html').to_s
UnicodeAnnotationCache = CacheDir.join('unicode-annotations.xml').to_s

# http://sourceforge.net/projects/ttf2ttc
TTCSplitBin = RootDir.join('scripts/split_ttcf.pl').to_s
TTFMergeBin = RootDir.join('scripts/merge2ttcf.pl').to_s


def extract_emoji(location)
  location_dir = location ? Pathname.new(File.expand_path(location)) : nil

  # these two are required
  info_plist = location && location_dir.join('SystemVersion.plist') || SystemInfoPlist
  emoji_path = location && location_dir.join('Apple Color Emoji.ttc') || EmojiFont

  # if this file hasn't updated, use the sytem one
  palette_plist = location && lambda {p = location_dir.join('Category-Emoji.plist'); p.exist? && p}.call || EmojiPlist

  puts "Info:  #{info_plist}"
  puts "Emoji: #{emoji_path}"

  raise 'info plist and emoji path must both exist' unless info_plist.exist? && emoji_path.exist?

  system_info = JSON.parse(`plutil -convert json -r -o - -- #{info_plist}`)

  Dir.mktmpdir('_emoji_font_') do |tmp_dir|
    Dir.chdir tmp_dir

    puts "Copy the latest version of Apple Color Emoji to temp..."
    cp emoji_path, 'emoji_font.ttc'

    puts "Split the emoji file TTC into tables..."
    `#{TTCSplitBin.shellescape} --input-ttf=emoji_font.ttc --output-prefix=emoji_tmp &>/dev/null`

    puts "Merge emoji tables into a TTF (this will take a while)..."
    `#{TTFMergeBin.shellescape} --output-ttf=emoji_font.ttf emoji_tmp_0.*.sdat &>/dev/null`

    puts "Add font to version database..."
    ttf = TTFunk::File.open('emoji_font.ttf')
    font_version = ttf.name.version[0]
    font_date = ttf.name.unique_subfamily[0][/(\d{4}\-\d\d\-\d\d)/]

    File.open(FontVersionFile, File::CREAT|File::RDWR) do |f|
      version_db = begin JSON.parse(f.read) rescue {} end
      if version_db.empty?
        puts "Version file is invalid JSON"
        break
      end
      version_db[font_version] ||= {"build_date" => font_date}
      (version_db[font_version]["macos_versions"] ||= []).push("#{system_info['ProductVersion']} (#{system_info['ProductBuildVersion']})").sort!.uniq!

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
  plist_contents = `plutil -convert json -r -o - -- "#{palette_plist}"`.strip
  File.open(FontPaletteDataFile, 'w') {|f| f.puts plist_contents}
end

desc "Extract the emoji TTF from the system TTC file"
task :extract_ttf do
  extract_emoji ENV['EMOJI_PATH']
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

  # Available methods on ttf.name: https://github.com/prawnpdf/ttfunk/blob/master/lib/ttfunk/table/name.rb
  font_data = {
    'metadata' => {
      'font_name' => ttf.name.font_name[0],
      'font_version' => ttf.name.version[0],
      'build_date' => ttf.name.unique_subfamily[0][/(\d{4}\-\d\d\-\d\d)/],
    },
    'glyphs' => {}
  }

  ttf.maximum_profile.num_glyphs.times do |glyph_id|
    bitmaps = ttf.sbix.all_bitmap_data_for(glyph_id)
    bitmap = bitmaps.detect {|b| b.ppem == size}
    next if bitmap.nil?

    ttf_name = ttf.postscript.glyph_for(glyph_id)
    codepoints, fitz_idx, fam = /^
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
          bits[1].to_i,
          bits[2]
        ]
      else
        nil
      end
    end

    fitz = fitz_idx && FitzpatrickModifiers[fitz_idx]

    next unless codepoints

    emoji_key = codepoints.int_to_hex.join('_')
    emoji_key += "_#{fam.fam_sort}" if fam

    emojilib_thing = emojilib_data[emoji_key] || {}

    emoji_filename = if /^\w[\w\-_]+\w$/ =~ emojilib_thing['emojilib_name']
      emojilib_thing['emojilib_name']
    else
      codepoints.int_to_hex.join('_')
    end

    emoji_filename += ".#{fam.fam_sort}" if fam
    emoji_filename += ".#{fitz_idx}" if fitz_idx > 0

    emoji_filename += ".#{bitmap.type}"

    font_data['glyphs'][emoji_key] ||= {
      'codepoints' => codepoints,
      'image' => nil,
      'fitz' => false,
    }

    if fitz_idx > 0
      (font_data['glyphs'][emoji_key]['fitz'] ||= [])[fitz_idx - 1] = EmojiImgDirRelative.join(emoji_filename)
    else
      font_data['glyphs'][emoji_key]['image'] = EmojiImgDirRelative.join(emoji_filename)
    end

    File.write(EmojiImgDir.join(emoji_filename), bitmap.data.read)
  end

  File.open(FontDataFile, 'w') {|f| f.puts JSON.pretty_generate(font_data)}
end

desc "Generate a JSON object of emoji with paths to images"
task :generate_emoji_db do
  emoji_file_data = JSON.parse(File.read FontPaletteDataFile)
  extra_metadata = YAML.load(File.read ExtraMetadataFile) || {}
  unicode_data = JSON.parse(File.read UnicodeDataFile)
  font_data = JSON.parse(File.read FontDataFile)
  annotation_data = JSON.parse(File.read UnicodeAnnotationFile)

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
    v['keywords']
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
      name = annotation_data['names'][e] || nil
      keywords = annotation_data['keywords'][e] || []

      emoji_key = key_codepoints.to_emoji_key

      data = emoji_data[emoji_key] || {
        name: name,
        emojilib_name: nil,
        codepoints: [],
        category: category,
        unicode_category: nil,
        unicode_subcategory: nil,
        keywords: keywords,
        emoji: nil,
        image: nil,
        year: nil,
        fitz: false,
      }

      if extra_metadata[emoji_key]
        extra_metadata[emoji_key].each do |k,v|
          # ensure keys are symbols
          key = k.to_sym
          if key === :keywords
            data[key] += v || []
          else
            data[key] = v
          end
        end
      end

      if uni
        data[:name] ||= uni['description'].downcase
        data[:unicode_category] = unicode_data['categories'][uni['category']]
        data[:unicode_subcategory] = unicode_data['subcategories'][uni['subcategory']]
      end

      if emojilib_data[emoji_key]
        # puts e, emojilib_data[e]
        data[:emojilib_name] = emojilib_data[emoji_key]['emojilib_name'] || nil
        data[:keywords] += emojilib_data[emoji_key]['keywords'] || []
      else
        # puts e + ' -- [no emojilib data] ' + key_codepoints.pack('U*') + ' -- [' + key_codepoints.join(',') + ']'
      end

      # TODO: name file with emojilib_name
      file_basename = emoji_key # data[:emojilib_name]

      data[:keywords].sort!.uniq!

      char_data = if gender
        font_data['glyphs']["#{emoji_key}_#{gender}"]
      else
        font_data['glyphs'][emoji_key] || {}
      end

      if !char_data
        puts "No char_data for #{emoji_key}"
      end

      # if gender is specified, it's not the default emoji gender
      if gender
        default_gender = 'WM'.gsub(gender, '')

        alt_char_data = font_data['glyphs']["#{emoji_key}_#{default_gender}"]

        data.merge!({
          image: alt_char_data['image'],
          image_alt: char_data['image'],
          default_gender: default_gender,
          codepoints_alt: emoji_codepoints,
          emoji_alt: e,
        })

        data[:fitz] ||= alt_char_data['fitz']
        data[:fitz_alt] ||= char_data['fitz']

      elsif data[:default_gender]
        data.merge!({
          emoji: e,
          codepoints: emoji_codepoints,
        })
      else
        data.merge!({
          emoji: e,
          codepoints: emoji_codepoints,
          image: char_data['image'],
          fitz: char_data['fitz'],
        })
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
  emoji_list = if File.exist?(EmojiListURLCache)
    puts "EmojiListURL is already cached, delete '#{File.basename EmojiListURLCache}' to re-download."
    File.read(EmojiListURLCache)
  else
    f = `curl #{EmojiListURL.shellescape}`
    File.write(EmojiListURLCache, f)
    f
  end
  doc = Nokogiri::HTML(emoji_list)
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

UnicodeAnnotationURL = 'http://www.unicode.org/repos/cldr/tags/latest/common/annotations/en.xml'

task :generate_annotations do
  file_contents = if File.exist?(UnicodeAnnotationCache)
    puts "UnicodeAnnotationURL is already cached, delete '#{File.basename UnicodeAnnotationCache}' to re-download."
    File.read(UnicodeAnnotationCache)
  else
    contents = `curl #{UnicodeAnnotationURL.shellescape}`
    File.write(UnicodeAnnotationCache, contents)
    contents
  end
  doc = Nokogiri::HTML(file_contents)

  names = {}
  keywords = {}

  doc.xpath('//ldml/annotations/annotation').each do |node|
    emoji = node.attr('cp')
    if node.attr('type') == 'tts'
      names[emoji] = node.text
    else
      keywords[emoji] = node.text.split('|').map(&:strip)
    end
  end

  File.open(UnicodeAnnotationFile, 'w') {|f| f.puts JSON.pretty_generate({
    names: names,
    keywords: keywords,
  })}
end

task :rebuild => [:extract_images, :build_unicode_db, :generate_emoji_db]
task :default => [:extract_ttf, :rebuild]
