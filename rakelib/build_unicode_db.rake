task :build_unicode_db => [:generate_annotations, :process_emoji_data] do
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

  unicode_db = {
    emoji: {},
  }

  seen_slugs = {}

  rows.each do |row|
    cells = row.css('td')
    next if cells.length === 0
    if cells.length === 1

    elsif cells.length === 3
      # :space: catches \u00a0 and friends
      emoji = cells[0].text.strip.gsub(/[[:space:]]/, '')
      emoji_key = emoji.to_codepoints.to_emoji_key
      description = cells[2].text.strip
      slug = description.slugify

      abort "duplicate emoji_key! #{emoji_key}" if unicode_db[:emoji][emoji_key]
      abort "seen slug! #{slug}" if seen_slugs[slug]
      seen_slugs[slug] = true

      unicode_db[:emoji][emoji_key] = {
        emoji: emoji,
        slug: slug,
        codepoints: emoji.to_codepoints,
        description: description,
      }
    end
  end

  sequence_data = JSON.parse(File.read SequenceFile)

  sequence_data.each do |k, v|
    newItem = {
      emoji: v['codepoints'].pack('U*'),
      codepoints: v['codepoints'],
      description: v['description'],
      slug: v['description'].slugify,
    }

    if unicode_db[:emoji][k]
      unicode_db[:emoji][k].merge!(newItem)
    else
      unicode_db[:emoji][k] = newItem
    end
  end

  File.open(UnicodeDataFile, 'w') {|f| f.puts JSON.pretty_generate(unicode_db)}
end
