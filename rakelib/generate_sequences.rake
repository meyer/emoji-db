task :process_emoji_data do
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
