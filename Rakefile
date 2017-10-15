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

CacheDir = RootDir.join('cache')
DataDir = RootDir.join('data')
EmojiImgDir = RootDir.join('emoji-img')
EmojiImgDirRelative = Pathname.new('./emoji-img')
FontDir = RootDir.join('fonts')
SystemEmojiFont = Pathname.new('/System/Library/Fonts/Apple Color Emoji.ttc')

ExtraKeywordsFile = RootDir.join('extra-keywords.yaml').to_s

# files to output
EmojiCategoryFile = DataDir.join('emoji-by-category.json').to_s
EmojiDBFile = RootDir.join('emoji-db.json').to_s
FontDataFile = FontDir.join('font-data.json').to_s
FontVersionFile = FontDir.join('versions.json').to_s
SequenceFile = DataDir.join('sequences.json').to_s
UnicodeAnnotationFile = DataDir.join('unicode-annotations.json').to_s
UnicodeDataFile = DataDir.join('unicode-data.json').to_s

task :rebuild => [:build_unicode_db, :generate_emoji_db]
task :default => [:rebuild]

desc "Copy `Apple Color Emoji.ttc` to font folder"
task :copy_latest do
  raise 'system emoji font does not exist' unless SystemEmojiFont.exist?

  ttf = TTFunk::Collection.open(SystemEmojiFont) do |ttc|
    ttc.find {|a| a.name.font_name[0] == 'Apple Color Emoji'}
  end

  font_version = ttf.name.version[0]
  font_date = ttf.name.unique_subfamily[0][/(\d{4}\-\d\d\-\d\d)/]
  ttc_name = "Apple Color Emoji #{font_version}.ttc"
  ttc_dest = FontDir.join(ttc_name)

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
    puts "`#{ttc_name}` has already been copied over"
  else
    cp ttc_src, ttc_dest
  end
end

desc "Extract emoji images from the latest TTF file"
task :generate_emoji_db => [:copy_latest] do
  ttf = if ENV['EMOJI_VERSION']
    emoji_ttf = FontDir.join("Apple Color Emoji #{ENV['EMOJI_VERSION']}.ttf")
    emoji_ttc = FontDir.join("Apple Color Emoji #{ENV['EMOJI_VERSION']}.ttc")

    if emoji_ttf.exist?
      TTFunk::File.open(emoji_ttf)
    elsif emoji_ttc.exist?
      TTFunk::Collection.open(emoji_ttc) do |ttc|
        ttc.find {|a| a.name.font_name[0] == 'Apple Color Emoji'}
      end
    else
      abort "Could not find `Apple Color Emoji #{ENV['EMOJI_VERSION']}.tt[cf]`"
    end
  else
    puts " - using system emoji font"
    TTFunk::Collection.open(SystemEmojiFont) do |ttc|
      ttc.find {|a| a.name.font_name[0] == 'Apple Color Emoji'}
    end
  end

  abort 'Emoji font file does not exist!' unless ttf

  puts "Run `npm update`..."
  # system "npm update"

  rm_rf EmojiImgDir
  mkdir_p EmojiImgDir

  extra_keywords = YAML.load(File.read ExtraKeywordsFile) || {}
  unicode_data = JSON.parse(File.read UnicodeDataFile)
  annotation_data = JSON.parse(File.read UnicodeAnnotationFile)
  sequence_data = JSON.parse(File.read SequenceFile)

  emojilib_data = JSON.parse(File.read('./node_modules/emojilib/emojis.json')).map do |k,v|
    # skip the weirdo keys
    next unless v.class == Hash && v['char']

    codepoints = v['char'].to_codepoints
    v['keywords'] ||= []
    v['keywords'].concat "#{k}".split('_')
    v['emojilib_name'] = k
    [codepoints.to_emoji_key, v]
  end.reject {|k| k.class != Array}.to_h

  # Available methods on ttf.name: https://github.com/prawnpdf/ttfunk/blob/master/lib/ttfunk/table/name.rb
  # font_data = {
  #   :font_name => ttf.name.font_name[0],
  #   :font_version => ttf.name.version[0],
  #   :build_date => ttf.name.unique_subfamily[0][/(\d{4}\-\d\d\-\d\d)/],
  # }

  emoji_data = {}
  seen_filenames = {}

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

    codepoints = sequence_data[emoji_key]['codepoints'] if sequence_data[emoji_key]

    emoji_string = codepoints.pack('U*')
    emojilib_thing = emojilib_data[emoji_key] || {}

    # special case for +1 and -1
    if emojilib_thing['emojilib_name']
      emojilib_thing['emojilib_name'] = case emojilib_thing['emojilib_name']
      when '+1' then 'thumbs_up'
      when '-1' then 'thumbs_down'
      else
        # just in case
        emojilib_thing['emojilib_name'].gsub(/^\+/, 'plus').gsub(/^\-/, 'minus')
      end
    end

    emoji_key = codepoints.to_emoji_key
    uni = unicode_data['emoji'][emoji_key]
    name = annotation_data['names'][emoji_key] || nil
    keywords = annotation_data['keywords'][emoji_key] || []

    emoji_filename = if /^[\w\-]+$/ =~ emojilib_thing['emojilib_name']
      emojilib_thing['emojilib_name']
    else
      emoji_key
    end

    emoji_filename += ".#{fam.fam_sort}" if fam
    emoji_filename += ".#{fitz_idx}" if fitz_idx > 0

    if seen_filenames[emoji_filename]
      emoji_filename = "#{emoji_filename}_#{emoji_key}"
      emoji_filename += ".#{fam.fam_sort}" if fam
      emoji_filename += ".#{fitz_idx}" if fitz_idx > 0
      abort "duplicate slug! #{emoji_filename}" if seen_filenames[emoji_filename]
    end
    seen_filenames[emoji_filename] = true

    emoji_filename += ".#{bitmap.type}"

    data = emoji_data[emoji_key] || {
      name: name,
      emojilib_name: nil,
      codepoints: codepoints,
      unicode_category: nil,
      unicode_subcategory: nil,
      keywords: keywords,
      emoji: emoji_string,
      image: nil,
      fitz: false,
    }

    if fitz_idx > 0
      (data[:fitz] ||= [])[fitz_idx - 1] = EmojiImgDirRelative.join(emoji_filename)
    else
      data[:image] = EmojiImgDirRelative.join(emoji_filename)
    end

    # write image to image dir
    File.write(EmojiImgDir.join(emoji_filename), bitmap.data.read)

    data[:keywords].concat(extra_keywords[emoji_key] || [])

    if uni
      data[:name] ||= uni['description']
      if uni['category']
        data[:unicode_category] = unicode_data['categories'][uni['category']]
        data[:unicode_subcategory] = unicode_data['subcategories'][uni['subcategory']]
      end
    end

    if emojilib_data[emoji_key]
      data[:emojilib_name] = emojilib_data[emoji_key]['emojilib_name'] || nil
      data[:keywords] += emojilib_data[emoji_key]['keywords'] || []
    end

    abort "Name for #{emoji_key} is missing" unless data[:name]
    data[:keywords].sort!.uniq!

    emoji_data[emoji_key] = data
  end

  puts "Emoji database updated! Size: #{emoji_data.keys.length.comma_separate} emoji, not including variants"

  File.write(EmojiDBFile, JSON.pretty_generate(emoji_data))
end

task :build_unicode_db => [:generate_annotations, :generate_sequences] do
  emoji_list_src = CacheDir.join('emoji-list-page.html').to_s

  # emoji minus ASCII numbers
  emoji_list_url = "http://unicode.org/cldr/utility/list-unicodeset.jsp?a=#{CGI.escape '[:emoji:]'}&g=emoji"

  emoji_list = if File.exist?(emoji_list_src)
    puts "emoji_list_url is already cached, delete '#{File.basename emoji_list_src}' to re-download."
    File.read(emoji_list_src)
  else
    f = `curl #{emoji_list_url.shellescape}`
    File.write(emoji_list_src, f)
    f
  end

  doc = Nokogiri::HTML(emoji_list)
  rows = doc.xpath('//blockquote/table/tr')

  categories = [nil]
  subcategories = [nil]

  unicode_db = {
    categories: [nil],
    subcategories: [nil],
    emoji: {},
  }

  current_category = nil
  current_subcategory = nil

  seen_slugs = {}

  rows.each do |row|
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
      emoji_key = emoji.to_codepoints.to_emoji_key
      description = cells[2].text.strip
      slug = description.downcase.gsub(/[^\w\-]/, '_').gsub(/^_|_$/, '')

      abort "duplicate emoji_key! #{emoji_key}" if unicode_db[:emoji][emoji_key]
      abort "seen slug! #{slug}" if seen_slugs[slug]
      seen_slugs[slug] = true

      unicode_db[:emoji][emoji_key] = {
        emoji: emoji,
        slug: slug,
        codepoints: emoji.to_codepoints,
        description: description,
        category: current_category,
        subcategory: current_subcategory,
      }
    end
  end

  unicode_db[:categories] = categories
  unicode_db[:subcategories] = subcategories

  sequence_data = JSON.parse(File.read SequenceFile)

  sequence_data.each do |k, v|
    new = {
      emoji: v['codepoints'].pack('U*'),
      slug: v['description'].downcase.gsub(/[^\w\-]/, '_'),
      codepoints: v['codepoints'],
      description: v['description'],
    }

    if unicode_db[:emoji][k]
      unicode_db[:emoji][k].merge!(new)
    else
      unicode_db[:emoji][k] = new.merge({
        category: 0,
        subcategory: 0,
      })
    end
  end

  File.open(UnicodeDataFile, 'w') {|f| f.puts JSON.pretty_generate(unicode_db)}
end

task :generate_annotations do
  $unicode_annotation_url = 'http://www.unicode.org/repos/cldr/tags/latest/common/annotations/en.xml'
  $unicode_annotation_src = CacheDir.join('unicode-annotations.xml').to_s

  file_contents = if File.exist?($unicode_annotation_src)
    puts "$unicode_annotation_url is already cached, delete '#{File.basename $unicode_annotation_src}' to re-download."
    File.read($unicode_annotation_src)
  else
    contents = `curl #{$unicode_annotation_url.shellescape}`
    File.write($unicode_annotation_src, contents)
    contents
  end
  doc = Nokogiri::HTML(file_contents)

  names = {}
  keywords = {}

  doc.xpath('//ldml/annotations/annotation').each do |node|
    emoji = node.attr('cp')
    emoji_key = emoji.to_codepoints.to_emoji_key
    if node.attr('type') == 'tts'
      names[emoji_key] = node.text
    else
      keywords[emoji_key] = node.text.split('|').map(&:strip)
    end
  end

  File.open(UnicodeAnnotationFile, 'w') {|f| f.puts JSON.pretty_generate({
    names: names,
    keywords: keywords,
  })}
end


task :generate_sequences do
  puts "Generating emoji sequence file..."
  sequence_data = {}
  [
    'emoji-sequences.txt',
    'emoji-zwj-sequences.txt',
    # 'emoji-variation-sequences.txt'
  ].each do |f|
    sequence_src = CacheDir.join(f)
    File.read(sequence_src).each_line do |line|
      next if line[0] == '#'
      line_sans_comment = line.split('#').first
      line_bits = line_sans_comment.split(';').map(&:strip)

      next unless line_bits.length == 3

      codepoint_string, category, desc = line_bits
      codepoints = codepoint_string.split.hex_to_int
      k = codepoints.to_emoji_key

      # ensure there's no overwriting
      if sequence_data[k]
        abort <<~UHOH
        Error: Already have a thing for `#{k}`! Compare:
        - Old: #{sequence_data[k][:codepoints].join(', ')}
        - New: #{codepoints.join(', ')}
        UHOH
      end

      if f === 'emoji-variation-sequences.txt'
        # third field is not a description
        sequence_data[k] = { codepoints: codepoints } if category === 'emoji style'
      else
        sequence_data[k] = { codepoints: codepoints, description: desc }
      end

    end
  end

  File.open(SequenceFile, 'w') {|f| f.puts JSON.pretty_generate(sequence_data)}
  puts "Done!"
end

task :compare_db do
  unicode_data = JSON.parse(File.read UnicodeDataFile)
  generated_data = JSON.parse(File.read EmojiDBFile)

  uni_keys = unicode_data['emoji'].keys
  gen_keys = generated_data.keys

  common_keys = uni_keys & gen_keys
  only_gen = gen_keys - uni_keys
  only_uni = uni_keys - gen_keys
  puts "#{common_keys.length} common keys"
  puts "#{only_gen.length} unique generated keys"
  puts "#{only_uni.length} unique unicode keys"

  puts '', "Unhandled generated keys:", only_gen.sort.map {|k| "- #{k} -- #{generated_data[k]['emoji']}\n"}.join
end
