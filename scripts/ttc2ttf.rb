#!/usr/bin/env ruby

require 'shellwords'
require 'tmpdir'
require 'fileutils'
require 'pathname'

ScriptDir = Pathname.new File.dirname(__FILE__)

TTCSplitBin = File.expand_path(ScriptDir.join('split_ttcf.pl'))
TTFMergeBin = File.expand_path(ScriptDir.join('merge2ttcf.pl'))

FontFile = File.expand_path(ARGV[0])
PWD = Pathname.new Dir.pwd

FontBasename = File.basename(FontFile, '.ttc')

Dir.mktmpdir('_emoji_font_') do |tmp_dir|
  # `open #{tmp_dir.shellescape}`
  Dir.chdir tmp_dir
  FileUtils.cp FontFile, 'emoji_font.ttc'

  puts "Split the emoji file TTC into tables..."
  `#{TTCSplitBin.shellescape} --input-ttf=emoji_font.ttc --output-prefix=emoji_tmp &>/dev/null`

  puts "Merge emoji tables into a TTF (this will take about 20 seconds)..."
  `#{TTFMergeBin.shellescape} --output-ttf=emoji_font.ttf emoji_tmp_0.*.sdat &>/dev/null`

  FileUtils.cp 'emoji_font.ttf', PWD.join("#{FontBasename}.ttf")
end
