require 'nokogiri'
require 'base64'
require 'json'
require './utils.rb'
require 'shellwords'

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

  emojiCategories = {
    'Code' =>        'codepoints',
    'Brow.' =>       'emoji',
    'B&W*' =>        'bw',
    'Apple' =>       'apple',
    'Googᵈ' =>       'android',
    'Twtr.' =>       'twitter',
    'Wind' =>        'windows',
    'FBM' =>         'fbm',
    'Sams.' =>       'samsung',
    'GMail' =>       'gmail',
    'DCM' =>         'docomo',
    'KDDI' =>        'kddi',
    'SB' =>          'softbank',
    'Name' =>        'name',
    'Keywords' =>    'keywords',
    'Date' =>        'year',
  }

  print 'Loading emoji HTML file... '
  doc = File.open(EmojiFile) {|d| Nokogiri::HTML(d)}
  rows = doc.xpath('//table/tr')
  puts 'Done!'

  # Make this a hash instead of an array so it can be inverted
  headings = rows.shift.css('th').map {|r| emojiCategories[r.text]}

  rows.each_with_index do |row, r_idx|
    cells = row.css('td')
    if cells.length === 0
      puts "Invalid row: #{r_idx + 1}"
      next
    end

    cell = cells[headings.index('emoji')]
    rowKey = emoji_to_key(cell.text)

    puts "Emoji #{r_idx+1} of #{rows.length}: #{cells[headings.index('name')].text}"

    rowHash = {
      'emojilib_name' => nil,
      'codepoints' => [],
      'name' => nil,
      'category' => nil,
      'keywords' => [],
      'images' => {},
    }

    cells.each_with_index do |cell, c_idx|
      heading = headings[c_idx]
      case heading
      when 'bw', 'apple', 'android', 'twitter', 'windows', 'gmail', 'docomo', 'kddi', 'softbank'
        next unless categories && categories.include?(heading) || categories.include?('all')

        img = cell.at_css('img')
        if img
          data = Base64.decode64(img['src'][/base64,(.+)$/, 1])
          ext = case data[0..9].strip.downcase
            when /png/ then 'png'
            when /gif89a/ then 'gif'
            else 'idk'
          end

          filename = File.join EmojiImgDir, "#{rowKey}-#{heading}.#{ext}"
          File.open(filename, 'wb') {|f| f.write(data)}

          rowHash['images'][heading] = filename
        else
          rowHash['images'][heading] = nil
        end
      when 'keywords' then rowHash['keywords'] = cell.text.split(/\,\s+/)
      when 'name' then rowHash['name'] = cell.text.downcase.split('≊')[0]
      when 'year' then rowHash['year'] = cell.text.gsub(/\D+/, '')
      # when 'emoji' then rowHash['code'] = cell.text
      when 'codepoints' then rowHash['codepoints'] = cell.text.downcase.scan(/[0-9a-f]+/)
      end
    end

    # Merge in interesting emojilib data
    if emojilib_data[rowKey]
      rowHash['emojilib_name'] = emojilib_data[rowKey]['emojilib_name'] || rowHash['emojilib_name']
      rowHash['category'] = emojilib_data[rowKey]['category'] || rowHash['category']
      rowHash['keywords'] = (emojilib_data[rowKey]['keywords'] || []) | rowHash['keywords']
    end

    # Conditionally merge in user-specified data
    if extra_metadata[rowKey] && extra_metadata[rowKey].class.to_s.downcase === 'hash'
      rowHash.merge!(extra_metadata[rowKey]) do |k, ov, nv|
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

    emojiDB[rowKey] = rowHash #.sort.to_h
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
