task :sort_annotations do
  annotation_data = JSON.parse(File.read UnicodeAnnotationFile)
  annotation_data['names'].unicode_sort!
  annotation_data['keywords'].unicode_sort!
  File.open(UnicodeAnnotationFile, 'w') {|f| f.puts JSON.pretty_generate(annotation_data)}
end
