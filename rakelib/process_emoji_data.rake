task :process_emoji_data do
  puts "Generating emoji sequence file..."
  sequence_data = {}
  [
    'unicode.org/Public/emoji/latest/emoji-sequences.txt',
    'unicode.org/Public/emoji/latest/emoji-zwj-sequences.txt',
  ].each do |f|
    sequence_src = DataDir.join(f)
    File.foreach(sequence_src) do |line|
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
  puts "Generated combined sequence file"

  emoji_test_data = {}

  current_group = nil
  current_subgroup = nil
  group_regex = /^# (?<sub>sub)?(group)\: (?<desc>.+)$/
  line_regex = /^(?<codepoints>[^;]+) ; (?<qual>[^#]+) # (?<emoji>\S+) (?<desc>.+)$/

  File.foreach(DataDir.join 'unicode.org/Public/emoji/latest/emoji-test.txt') do |line|
    line.strip!
    group_match = line.match(group_regex)

    if group_match
      # check to see if sub matched
      if group_match[:sub]
        current_subgroup = group_match[:desc].strip
        puts "\n#{current_group} --> #{current_subgroup}"
      else
        current_group = group_match[:desc].strip
      end
      next
    end

    next if line[0] == '#' || line == ''

    line_match = line.match(line_regex)
    next unless line_match

    next if line_match[:qual] == 'non-fully-qualified'

    codepoints = line_match[:codepoints].strip.split.hex_to_int
    emoji_key = codepoints.to_emoji_key

    puts "wow: #{emoji_key} -- #{line_match[:emoji]} -- #{line_match[:desc]}"

    emoji_test_data[emoji_key] = {
      emoji: line_match[:emoji],
      desc: line_match[:desc],
      group: current_group,
      subgroup: current_subgroup,
    }
  end

  File.open(TestDataFile, 'w') {|f| f.puts JSON.pretty_generate(emoji_test_data)}
end
