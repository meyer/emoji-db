def key_to_emoji(key); key.split('_').map {|u| [u.hex].pack('U')}.join(''); end

def emoji_to_key(uni);
  uni.chars.map do |c|
    "%04x" % c.unpack('U')[0]
  end.delete_if do |c|
    # remove variation selector
    # TODO: maybe add it to key_to_emoji
    c === 'fe0f'
  end.join('_')
end
