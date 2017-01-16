#!/usr/bin/env ruby

require 'shellwords'
require 'tmpdir'
require 'fileutils'
require 'pathname'
require 'ttfunk'

ScriptDir = Pathname.new File.dirname(__FILE__)
FontFile = File.expand_path(ARGV[0])

ttf = TTFunk::File.open(FontFile)

puts <<-INFO
font_name:         #{ttf.name.font_name[0]}
version:           #{ttf.name.version[0]}
unique_subfamily:  #{ttf.name.unique_subfamily[0]}
font_family:       #{ttf.name.font_family[0]}
font_subfamily:    #{ttf.name.font_subfamily[0]}
INFO
