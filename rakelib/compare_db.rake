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
