desc "Copy `Apple Color Emoji.ttc` to font folder"
task :copy_latest do
  raise 'system emoji font does not exist' unless SystemEmojiFont.exist?

  ttf = TTFunk::Collection.open(SystemEmojiFont) do |ttc|
    ttc.find {|a| a.name.font_name[0] == 'Apple Color Emoji'}
  end

  font_version = ttf.name.version[0].to_s
  font_date = ttf.name.unique_subfamily[0][/(\d{4}\-\d\d\-\d\d)/].to_s
  ttc_name = "Apple Color Emoji #{font_version}.ttc"
  ttc_dest = FontDir.join(ttc_name)

  info_plist = '/System/Library/CoreServices/SystemVersion.plist'
  system_info = JSON.parse(`plutil -convert json -r -o - -- #{info_plist.shellescape}`)
  system_nicename = "#{system_info['ProductVersion']} (#{system_info['ProductBuildVersion']})"

  puts "Add font to version database..."
  File.open(FontVersionFile, File::CREAT|File::RDWR) do |f|
    version_db = begin YAML.load(f.read) rescue {} end
    if version_db.empty?
      puts "Version file is invalid"
      break
    end
    version_db[font_version] ||= {"build_date" => font_date}
    (version_db[font_version]["macos_versions"] ||= []).push(system_nicename).sort!.uniq!

    f.rewind
    f.puts YAML.dump(version_db)
    f.flush
    f.truncate(f.pos)

    File.open(FontVersionJsonFile, 'w') do |j|
      j.write(JSON.pretty_generate(version_db))
    end
  end

  if ttc_dest.exist?
    puts "`#{ttc_name}` has already been copied over"
  else
    cp SystemEmojiFont, ttc_dest
  end
end
