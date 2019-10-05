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

  puts "Run `yarn add emojilib@latest`"
  system "yarn add emojilib@latest"

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
    name = annotation_data['names'][emoji_key] || uni['description'] || nil
    keywords = annotation_data['keywords'][emoji_key] || []
    gender = fam === 'M' || fam === 'W' ? fam : nil

    emoji_filename = if uni['slug']
      uni['slug']
    elsif /^[\w\-]+$/ =~ emojilib_thing['emojilib_name']
      emojilib_thing['emojilib_name']
    else
      emoji_key
    end

    emoji_filename += ".#{fam.fam_sort}" if fam
    emoji_filename += ".#{fitz_idx}" if fitz_idx > 0

    if seen_filenames[emoji_filename]
      puts "Emoji filename for `#{emoji_key}` (#{emoji_filename}) is a dupe"
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
      keywords: [],
      emoji: emoji_string,
      image: nil,
      fitz: false,
    }

    if gender
      data[:default_gender] = data[:default_gender] || gender
    end

    fitz_key = gender && data[:default_gender] != gender ? :fitz_alt : :fitz
    image_key = gender && data[:default_gender] != gender ? :image_alt : :image

    if fitz_idx > 0
      (data[fitz_key] ||= [])[fitz_idx - 1] = EmojiImgDirRelative.join(emoji_filename)
    else
      data[image_key] = EmojiImgDirRelative.join(emoji_filename)
    end

    # write image to image dir
    File.write(EmojiImgDir.join(emoji_filename), bitmap.data.read)

    data[:keywords].concat(keywords, extra_keywords[emoji_key] || [])

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
