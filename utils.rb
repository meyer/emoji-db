def emoji_to_codepoints(uni)
  uni.chars.map do |c|
    c.unpack('U')[0]
  end.delete_if do |c|
    # remove variation selector
    # TODO: maybe add it to key_to_emoji
    # c === 0xfe0f
  end
end
