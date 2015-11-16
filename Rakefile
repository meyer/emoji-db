require 'base64'
require 'json'
require './utils.rb'

EmojiURL = 'http://unicode.org/emoji/charts/full-emoji-list.html'
EmojiFile = './unicode.org-dump.html'
EmojiImgDir = './emoji-img'

def generateEmojiDB(*categories)
  FileUtils.rm_rf EmojiImgDir
  FileUtils.mkdir_p EmojiImgDir

  extra_metadata = JSON.parse(File.read('./extra-metadata.json'))

  emojilib_data = {}
  JSON.parse(File.read('./node_modules/emojilib/emojis.json')).each do |k,v|
    # skip the weirdo keys
    next unless v.class.to_s.downcase === 'hash' && v['char']

    key = emoji_to_key(v['char'])
    v['keywords'] ||= []
    v['keywords'].concat "#{k}".split('_')
    v['emojilib_name'] = k

    emojilib_data[key] = v

    # multibyte flags are getting mauled for some reason :/
    # puts emoji_to_key(v['char']) + ": " + v['char']
  end

  emojiDB = {}

  emojiCategories = [
    'bw',
    'apple',
    'android',
    'twitter',
    'windows',
    'gmail',
    'docomo',
    'kddi',
    'softbank',
  ]

  key = nil
  idx = 0

  # Parse HTML with regular expressions? why not.
  IO.foreach(EmojiFile) do |f|
    case f.strip
    when /<table/
      #
    when /th(?:.+)>(.+)<\/th/
      #
    when /<a(?:.+)name='(.+)'/
      print '.'
      key = $1
      # puts key
      code = key_to_emoji(key)

      emojiDB[key] = {
        'emojilib_name' => emojilib_data[key] && emojilib_data[key]['emojilib_name'] || nil,
        'code' => code,
        'name' => nil,
        'category' => emojilib_data[key] && emojilib_data[key]['category'] || nil,
        # 'default' => nil,
        'keywords' => emojilib_data[key] && emojilib_data[key]['keywords'] || [],
        'images' => {},
        'year' => nil,
      }

      if extra_metadata[key] && extra_metadata[key].class.to_s.downcase === 'hash'
        emojiDB[key].merge!(extra_metadata[key]) do |k, ov, nv|
          case k
          # overwrite string
          when 'name', 'emojilib_name' then nv
          # merge array
          when 'category', 'keywords' then (nv || []) | (ov || [])
          # prevent other keys from being overwritten
          else ov
          end
        end
      end

    when /src='data:image\/png;base64,(.+)'/
      cat = emojiCategories[idx]

      if categories && !categories.include?(cat)
        idx += 1
        next
      end

      data = Base64.decode64($1)

      ext = case data[0..9].strip.downcase
        when /png/ then 'png'
        when /gif89a/ then 'gif'
        else 'idk'
      end

      filename = File.join EmojiImgDir, "#{key}-#{cat}.#{ext}"
      File.open(filename, 'wb') {|f| f.write(data)}

      emojiDB[key]['images'][cat] = filename
      idx += 1

    when /missing/
      cat = emojiCategories[idx]
      if categories && !categories.include?(cat)
        idx += 1
        next
      end

      emojiDB[key]['images'][cat] = nil
      idx += 1

    # when /<td class='default'>(.+)</
    #   emojiDB[key]['default'] = $1

    when /<td class='name'>(.+)</
      if $1.include? '<a'
        keywords = $1.gsub(/<\/?a(?:[^>]*)>/, '')
        emojiDB[key]['keywords'] = (emojiDB[key]['keywords'] || []) | keywords.split(', ')
      else
        emojiDB[key]['name'] = $1
      end

    when /<td class='age'>(?:\D*)(\d+)(?:\D*)</
      emojiDB[key]['year'] = $1 * 1

    when '</tr>'
      key = nil
      idx = 0
    end
  end

  File.open('emoji-db.json', 'w') do |f|
    f.write(JSON.pretty_generate(emojiDB))
  end
end

desc 'Downloads latest emoji database from Unicode.org'
task :get_emoji_ref do
  if File.exist?(EmojiFile)
    puts "Unicode.org emoji index is already cached, delete '#{EmojiFile}' to re-download."
  else
    `curl #{EmojiURL} > #{EmojiFile}`
  end
end

desc 'Turns the downloaded emoji HTML file into a JSON file (no images)'
task :generate_db_no_images do; generateEmojiDB(nil); end

desc 'Turns the downloaded emoji HTML file into a JSON file'
task :generate_db do; generateEmojiDB('apple'); end

task :default => [:get_emoji_ref, :generate_db_no_images]