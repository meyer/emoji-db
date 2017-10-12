require 'base64'
require 'cgi'
require 'json'
require 'nokogiri'
require 'pathname'
require 'set'
require 'shellwords'
require 'tmpdir'
require 'ttfunk'
require 'yaml'

require './utils.rb'

RootDir = Pathname.new Rake.application.original_dir

DataDir = RootDir.join('data')
FontDir = RootDir.join('fonts')
CacheDir = RootDir.join('cache')
EmojiImgDir = RootDir.join('emoji-img')
EmojiImgDirRelative = Pathname.new('./emoji-img')

ExtraMetadataFile = RootDir.join('extra-metadata.yaml').to_s

# files to output
EmojiDBFile = RootDir.join('emoji-db.json').to_s
FontVersionFile = FontDir.join('versions.json').to_s
FontDataFile = FontDir.join('font-data.json').to_s
EmojiCategoryFile = DataDir.join('emoji-by-category.json').to_s
UnicodeDataFile = DataDir.join('unicode-data.json').to_s
UnicodeAnnotationFile = DataDir.join('unicode-annotations.json').to_s

# emoji minus ASCII numbers
EmojiQuery = '[:emoji:] - \p{Block=Basic Latin}'
EmojiListURL = "http://unicode.org/cldr/utility/list-unicodeset.jsp?a=#{CGI.escape EmojiQuery}&g=emoji"
EmojiListURLCache = CacheDir.join('emoji-list-page.html').to_s
UnicodeAnnotationCache = CacheDir.join('unicode-annotations.xml').to_s

task :npm_update do
  puts "Running `npm update`..."
  system "npm update"
end

def ensure_emoji_version
  raise 'EMOJI_VERSION environmental variable must be set' unless ENV['EMOJI_VERSION']
end

desc "Copy `Apple Color Emoji.ttc` to font folder"
task :copy_latest do
  ttc_src = Pathname.new '/System/Library/Fonts/Apple Color Emoji.ttc'
  raise 'source TTC do not exist' unless ttc_src.exist?

  ttf = TTFunk::Collection.open(ttc_src) do |ttc|
    ttc.find {|a| a.name.font_name[0] == 'Apple Color Emoji'}
  end

  font_version = ttf.name.version[0]
  font_date = ttf.name.unique_subfamily[0][/(\d{4}\-\d\d\-\d\d)/]
  ttc_dest = FontDir.join("Apple Color Emoji #{font_version}.ttc")

  info_plist = '/System/Library/CoreServices/SystemVersion.plist'
  system_info = JSON.parse(`plutil -convert json -r -o - -- #{info_plist.shellescape}`)
  system_nicename = "#{system_info['ProductVersion']} (#{system_info['ProductBuildVersion']})"

  puts "Add font to version database..."
  File.open(FontVersionFile, File::CREAT|File::RDWR) do |f|
    version_db = begin JSON.parse(f.read) rescue {} end
    if version_db.empty?
      puts "Version file is invalid JSON"
      break
    end
    version_db[font_version] ||= {"build_date" => font_date}
    (version_db[font_version]["macos_versions"] ||= []).push(system_nicename).sort!.uniq!

    f.rewind
    f.puts JSON.pretty_generate(version_db)
    f.flush
    f.truncate(f.pos)
  end

  if ttc_dest.exist?
    puts "TTC file has already been copied over"
  else
    cp ttc_src, ttc_dest
  end
end

desc "Extract emoji images from the latest TTF file"
task :extract_images => [:npm_update] do
  ensure_emoji_version
  emoji_ttf = FontDir.join("Apple Color Emoji #{ENV['EMOJI_VERSION']}.ttf")
  emoji_ttc = FontDir.join("Apple Color Emoji #{ENV['EMOJI_VERSION']}.ttc")

  ttf = if emoji_ttf.exist?
    TTFunk::File.open(emoji_ttf)
  elsif emoji_ttc.exist?
    TTFunk::Collection.open(emoji_ttc) do |ttc|
      ttc.find {|a| a.name.font_name[0] == 'Apple Color Emoji'}
    end
  end

  abort 'Emoji font file does not exist!' unless ttf

  rm_rf EmojiImgDir
  mkdir_p EmojiImgDir

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
    bitmap = bitmaps.max_by(&:ppem)
    ttf_name = ttf.postscript.glyph_for(glyph_id)

    if bitmap.nil?
      # puts "glyph #{glyph_id} (#{ttf_name}) has no bitmaps"
      next
    end

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

    next unless codepoints

    emoji_key = codepoints.int_to_hex.join('_')
    emoji_key += "_#{fam.fam_sort}" if fam

    emojilib_thing = emojilib_data[emoji_key] || {}

    # if emojilib_thing['emojilib_name']
    #   emojilib_thing['emojilib_name'] = emojilib_thing['emojilib_name'].gsub(/^\+/, 'plus').gsub(/^\-/, 'minus')
    # end

    # emoji_filename = if /^[\w\-_]+$/ =~ emojilib_thing['emojilib_name']
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
task :generate_emoji_db => [:npm_update] do
  extra_metadata = YAML.load(File.read ExtraMetadataFile) || {}
  unicode_data = JSON.parse(File.read UnicodeDataFile)
  font_data = JSON.parse(File.read FontDataFile)
  annotation_data = JSON.parse(File.read UnicodeAnnotationFile)

  emoji_by_category = {}

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
task :default => [:rebuild]
