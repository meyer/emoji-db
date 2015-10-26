require 'base64'
require 'json'

EmojiURL = 'http://unicode.org/emoji/charts/full-emoji-list.html'
EmojiFile = './emoji.html'
EmojiImgDir = './emoji-img'

def generateEmojiDB(*categories)
  FileUtils.rm_rf EmojiImgDir
  FileUtils.mkdir_p EmojiImgDir

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
      key = $1
      code = key.split('_').map{|u| [u.hex].pack('U')}.join('')
      emojiDB[key] = {
        'code' => code,
        'name' => nil,
        # 'default' => nil,
        'keywords' => [],
        'images' => {},
        'version' => nil,
      }

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
      File.open(filename, 'wb') do |f|
        f.write(data)
      end

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
        emojiDB[key]['keywords'] = keywords.split(', ')
      else
        emojiDB[key]['name'] = $1
      end

    when /<td class='age'>(?:.+)(\d+\.\d+)(?:.+)</
      emojiDB[key]['version'] = $1 * 1

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
task :get_emoji_ref do; `curl #{EmojiURL} > #{EmojiFile}`; end

desc 'Turns the downloaded emoji HTML file into a JSON file (no images)'
task :generate_db_no_images do; generateEmojiDB(nil); end

desc 'Turns the downloaded emoji HTML file into a JSON file'
task :generate_db do; generateEmojiDB('apple'); end

task :default => [:get_emoji_ref, :generate_db]