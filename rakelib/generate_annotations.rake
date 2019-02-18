task :generate_annotations do
  mkdir_p CacheDir

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
    names: names.unicode_sort,
    keywords: keywords.unicode_sort,
  })}
end
