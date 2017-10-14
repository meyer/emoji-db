FitzpatrickModifiers = [
  nil, # modifiers go from 1-5
  0x1f3fb,
  0x1f3fc,
  0x1f3fd,
  0x1f3fe,
  0x1f3ff,
]

FamCodepoints = {
  0x1f466 => 'B', # boy emoji
  0x1f467 => 'G', # girl emoji
  0x1f468 => 'M', # man emoji
  0x1f469 => 'W', # woman emoji
}

GenderCodepoints = {
  0x02640 => 'W',
  0x02642 => 'M',
}

KissCodepoints = [
  0x1f468,
  0x1f469,
  0x1f48b,
  0x2764,
]

HeartCodepoints = [
  0x1f468,
  0x1f469,
  0x2764,
]

UnicodeJoiners = [
  0x200d,
  0xfe0f,
  0xfe0e,
]

class String
  def fam_sort
    self.split('').sort_by {|e| 'MWGB'.index(e) || -1}.join('')
  end

  def to_codepoints
    self.chars.map do |c|
      c.unpack('U')[0]
    end.delete_if do |c|
      # remove variation selector
      # TODO: maybe add it to key_to_emoji
      # c === 0xfe0f
    end
  end
end

class Integer
  def comma_separate
    # thanks, stack overflow
    self.to_s.reverse.gsub(/...(?=.)/,'\&,').reverse
  end

  def to_unicode
    self.to_s(16).rjust(4, '0')
  end
end

class Array
  def int_to_hex
    self.map {|e| e.is_a?(Numeric) ? e.to_unicode : e.to_s}
  end

  def hex_to_int
    self.map {|e| e.to_i(16)}
  end

  def to_fam_string
    self.map {|p| FamCodepoints[p]}.compact.join('').fam_sort
  end

  def reject_joiners
    self.reject {|c| UnicodeJoiners.include?(c)}
  end

  def to_emoji_key
    codepoints = self.reject_joiners

    # special case 1: people group defaults
    if codepoints === [0x1f48f]
      # default kiss emoji"
      return '1f48f_MW'
    elsif codepoints === [0x1f491]
      # default heart emoji"
      return '1f491_MW'
    elsif codepoints === [0x1f46a]
      # default family emoji"
      return '1f46a_MWB'
    end

    # special case 2: kiss/heart emoji
    if codepoints.length > 1
      if (codepoints - HeartCodepoints).length === 0
        return "1f491_#{codepoints.to_fam_string}"
      elsif (codepoints - KissCodepoints).length === 0
        return "1f48f_#{codepoints.to_fam_string}"
      end
    end

    if (
        # Exclude MWBG emoji
        codepoints.length > 1 &&
        # only MWBG emoji?
        (codepoints - FamCodepoints.keys).empty?
      )

      # fam emoji + MWBG string
      [
        0x1f46a,
        codepoints.to_fam_string,
      ]
    else
      codepoints
    end.int_to_hex.join('_')
  end
end
