#!/usr/bin/env perl

while ( $_ = shift( @ARGV ) )
{
  if ( /^--output-prefix=/ )
  {
    s/^[^=]*=//;
    $output_prefix = $_;
  }
  elsif ( /^--input-ttf=/ )
  {
    s/^[^=]*=//;
    $input_ttf = $_;
  }
  elsif ( /^--align-32bit/ )
  {
    $align_32bit = TRUE;
  }
}

die( "Require prefix to write TTF tables\n" ) if ( 0 == length( $output_prefix ) );

if ( 0 < length( $input_ttf ) )
{
  open( TTF, "$input_ttf" ) || die;
}
else
{
  open( TTF, "<&STDIN") || die ;
}

read( TTF, $file_hdr_magic, 4 ) || die;
if ( "ttcf" eq $file_hdr_magic )
{
  read( TTF, $version, 4 ) || die;
  die( "broken TTC header" ) if ( "\000\001\000\000" != $version );
  read( TTF, $_, 4 ) || die;
  $face_max = unpack( "N", $_ );
  for ( $i = 0; $i < $face_max; $i ++ )
  {
    read( TTF, $_, 4 ) || die;
    $offset_to_face[ $i ] = unpack( "N", $_ );
  }
}
elsif ( "true" eq $file_hdr_magic || "\000\001\000\000" eq $file_hdr_magic )
{
  $face_max = 1;
  $offset_to_face[ 0 ] = 0;
  seek( TTF, 0, 0 );
}
else
{
  die( "This is NOT TrueType Font nor TrueType Collection." );
}




for ( $j = 0; $j < $face_max; $j ++ )
{
  seek( TTF, $offset_to_face[$j], 0 ) || die;

  read( TTF, $ttf_tbldir_hdr, 4 + 2 + 2 + 2 + 2 ) || die;
  ( $sfnt_version,	# 32bit: 0x00010000 or sfnt or OTTO
    $numTables,		# unsigned 16bit
    $searchRange,		# unsigned 16bit
    $entrySelector,	# unsigned 16bit
    $rangeShift		# unsigned 16bit
  ) = unpack( "Nnnnn", $ttf_tbldir_hdr );
  
  printf( STDERR "*** this font file include %d tables\n", $numTables );
  
  for ( $i = 0; $i < $numTables; $i ++ )
  {
    read( TTF, $tag, 4 ) || die;
    read( TTF, $_, 4 + 4 + 4 ) || die;
    ( $checkSum, $offset, $length ) = unpack( "NNN", $_ );
    printf( STDERR "*** table %s @ 0x%08x\n", $tag, $offset );
    $ttf_tbldir{ $tag } = join( ",", ( $checkSum, $offset, $length ) );
  }
  
  foreach $tag ( sort( keys( %ttf_tbldir ) ) )
  {
    ( $checkSum, $offset, $length ) = split( ",", $ttf_tbldir{ $tag } );
    printf( STDERR "*** seeking table %s @ 0x%08x\n", $tag, $offset );
    seek( TTF, $offset, 0 ) || die;
    read( TTF, $_, $length ) || die;
  
    $sfnt_tblout_pathname = sprintf( "%s_%d.%s.sdat", $output_prefix, $j, $tag );
    $sfnt_tblout_pathname =~ s,/,_,g;
    printf( STDERR "dump sfnt table \"%s\" to file \"%s\"\n", $tag, $sfnt_tblout_pathname );
    open( TBLOUT, "> $sfnt_tblout_pathname" ) || die;
    syswrite( TBLOUT, $_, $length ) || die;
    if ( defined( $align_32bit ) && $align_32bit && 0 != ( $length % 4 ) )
    {
      for ( $i = 0; $i < ( $length % 4 ); $i ++ )
      {
        syswrite( TBLOUT, '\0', 1 ) || die;
      }
    }
    close( TBLOUT ) || die;
  }
}
