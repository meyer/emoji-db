#!/usr/bin/env perl

use File::Basename;

sub path2fts
{
  my $path;
  ( $path ) = @_;

  my @tok    = split( /\./, basename( $path ) );
  my $suffix = pop( @tok );
  my $tag    = pop( @tok );
  my $face   = join( ".", @tok );

  printf( "face=%s, tag=%s, suffix=%s\n", $face, $tag, $suffix );
  return ( $face, $tag, $suffix );
}



%tag2ttf_order = (
	"head" =>  1,
	"hhea" =>  2,
	"maxp" =>  3,
	"OS/2" =>  4,
	"hmtx" =>  5,
	"LTSH" =>  6,
	"VDMX" =>  7,
	"hdmx" =>  8,
	"cmap" =>  9,
	"fpgm" => 10,
	"prep" => 11,
	"cvt " => 12,
	"loca" => 13,
	"glyf" => 14,
	"kern" => 15,
	"name" => 16,
	"post" => 17,
	"gasp" => 18,
	"PCLT" => 19,
	"DSIG" => 20,
);

%tag2cff_order = (
	"head" =>  1,
	"hhea" =>  2,
	"maxp" =>  3,
	"OS/2" =>  4,
	"name" =>  5,
	"cmap" =>  6,
	"post" =>  7,
	"CFF " =>  8,
);


$dont_sort_tables = 0;
$has_CFF  = 0;
$has_glyf = 0;

while ( $_ = shift( @ARGV ) )
{
  if ( /--output-file=/ )
  {
    s/^[^=]*=//;
    $output_ttc = $_;
  }
  elsif ( /--output-ttf=/ )
  {
    $generate_ttc_hdr = 0;
    s/^[^=]*=//;
    $output_ttc = $_;
  }
  elsif ( /--output-ttc=/ )
  {
    $generate_ttc_hdr = 1;
    s/^[^=]*=//;
    $output_ttc = $_;
  }
  elsif ( /--format=/ )
  {
    s/^[^=]*=//;
    $_ = lc( $_ );
    $generate_ttc_hdr = 0 if ( /ttf/ );
    $generate_ttc_hdr = 1 if ( /ttc/ );
  }
  elsif ( /--dont-sort-tables/ )
  {
    $dont_sort_tables = 1;
  }
  elsif ( -r $_ )
  {
    push( @SDAT_arg, $_ );

    ( $tmp_face, $tag, $suffix ) = & path2fts( $_ );
    # s/.[^.]*$//;
    # $tag = substr( $_, length( $_ ) - 4, 4 );
    if ( $tag eq "CFF " )
    {
      $has_CFF ++;
    }
    elsif ( $tag eq "glyf" )
    {
      $has_glyf ++;
    }
  }
}

die( "Require TTCF output pathname" ) if ( 0 == length( $output_ttc ) );


if ( $dont_sort_tables > 0 )
{
  @SDAT = @SDAT_arg;
}
else
{
  @SDAT = sort {
    @tok_a = split( /[\.\/]/, $a );
    $suffix_a   = pop( @tok_a );
    $tag_a      = pop( @tok_a );
    $fontname_a = join( ",", @tok_a );
    $order_a = $tag2ttf_order{ $tag_a };
    $order_a = $tag2cff_order{ $tag_a } if ( $has_CFF > 0 );
    $order_a = 100 if ( $order_a == 0 );

  
    @tok_b = split( /[\.\/]/, $b );
    $suffix_b   = pop( @tok_b );
    $tag_b      = pop( @tok_b );
    $fontname_b = join( ",", @tok_b );
    $order_b = $tag2ttf_order{ $tag_b };
    $order_b = $tag2cff_order{ $tag_b } if ( $has_CFF > 0 );
    $order_b = 100 if ( $order_b == 0 );
  
    if ( $font_a != $font_b )
    {
      $font_a cmp $font_b;
    }
    elsif ( $order_a != $order_b )
    {
      $order_a <=> $order_b;
    }
    else
    {
      lc( $a ) cmp lc( $b )
    }
  } @SDAT_arg;
}


$merged_tbl_length = 0;
foreach $tbl_file ( @SDAT )
{
  # ( $face, $tag, $suffix ) = split( /[\.\/]/, $tbl_file );
  ( $face, $tag, $suffix ) = & path2fts( $tbl_file );
  # printf( STDERR "path=%s face=%s tag=%s suffix=%s\n", $tbl_file, $face, $tag, $suffix );
  $length   = 0;
  $checksum_lo16 = 0;
  $checksum_hi16 = 0;

  printf( STDERR "*** calculate checksum for %s:", $tbl_file );
  open( TBL, "$tbl_file" ) || die;
  while( ( $ret = read( TBL, $_, 4 ) ) > 0 )
  {
    $length += $ret;
    for ( ; $ret < 4; $ret ++ )
    {
      $_ = $_ . "\000";
    }
    ( $hi16, $lo16 ) = unpack( "nn", $_ );
    $checksum_lo16 += $lo16;
    $checksum_hi16 += $hi16 + ( $checksum_lo16 >> 16 ) ;
    $checksum_lo16 = $checksum_lo16 & 0xFFFF;
    $checksum_hi16 = $checksum_hi16 & 0xFFFF;
    # printf( STDERR " 0x%04x04x", $checksum_hi16, $checksum_lo16 );
  }
  $checkSum = ( $checksum_hi16 << 16 ) + $checksum_lo16;
  close( TBL ) || die;
  # printf( STDERR ", 0x%08x", $length );
  printf( STDERR ", 0x%08x", $checkSum );

  $num_tbl_in_face{ $face } ++;

  $tbl_id = join( ",", $tag, $length, $checkSum );
  $tbl_path2id{ $tbl_file } = $tbl_id;
  # printf( STDERR " path=%s -> id=%s", $tbl_file, $tbl_id );

  if ( !defined( $offset_tbl_no_hdr{ $tbl_id } ) )
  {
    # printf( STDERR "schedule table %s at 0x%08x", $tbl_id, $merged_tbl_length );
    $offset_tbl_no_hdr{ $tbl_id } = $merged_tbl_length;
    $merged_tbl_length += $length ;
  }
  printf( STDERR "\n" );
}

@ttcf_face = sort( keys( %num_tbl_in_face ) );

open( TTCF, "> $output_ttc" ) || die;

if ( $#ttcf_face > 0 || ( defined( $generate_ttc_hdr ) && $generate_ttc_hdr > 1 ) )
{
  syswrite( TTCF, "ttcff", 4 ) || die;
  syswrite( TTCF, pack( "N", 0x00010000 ), 4 ) || die;
  syswrite( TTCF, pack( "N", $#ttcf_face + 1 ), 4 ) || die;

  for ( $i = 0; $i <= $#ttcf_face; $i ++ )
  {
    # count TTCF header
    $offset_to_face{ $ttcf_face[ $i ] }  = 12;			# TTCF minimum header
    $offset_to_face{ $ttcf_face[ $i ] } += ( $#ttcf_face + 1 ) * 4;	# TTCF face directory length

    # count preceding TTF face header
    for ( $j = 0; $j < $i; $j ++ )
    {
      $offset_to_face{ $ttcf_face[ $i ] } += 12;
      $offset_to_face{ $ttcf_face[ $i ] } += 16 * $num_tbl_in_face{ $ttcf_face[ $j ] } ;
    }

    syswrite( TTCF, pack( "N", $offset_to_face{ $ttcf_face[ $i ] } ), 4 ) || die;
  }
}

$offset_to_merged_tbl  = $offset_to_face{ $ttcf_face[ $#ttcf_face ] };
$offset_to_merged_tbl += 12 ;
$offset_to_merged_tbl += 16 * $num_tbl_in_face{ $ttcf_face[ $#ttcf_face ] } ;

for ( $i = 0; $i < ( $#ttcf_face + 1 ); $i ++ )
{
  syswrite( TTCF, pack( "N", 0x00010000 ), 4 ) || die;

  $numTables = $num_tbl_in_face{ $ttcf_face[ $i ] };
  $searchRange   = 1;
  $entrySelector = 1;
  while ( ( $searchRange * 2 <= $numTables ) && ( $searchRange < 0x8000 ) )
  {
    $searchRange    = $searchRange * 2;
    $entrySelector += 1;
  }
  $entrySelector -= 1;
  $searchRange    = $searchRange * 16;
  $rangeShift     = $numTables * 16 - $searchRange;
  syswrite( TTCF, pack( "nnnn", $numTables, $searchRange, $entrySelector, $rangeShift ), 8 ) || die;

  foreach $tbl_file ( sort( @SDAT ) )
  {
    # ( $face, $tag, $suffix ) = split( /[\.\/]/, $tbl_file );
    ( $face, $tag, $suffix ) = & path2fts( $tbl_file );
    if ( $face eq $ttcf_face[ $i ] )
    {
      $tbl_id = $tbl_path2id{ $tbl_file };
      ( $tag, $length, $checkSum ) = split( /,/, $tbl_id );
      # $offset = $offset_to_merged_tbl - $offset_to_face{ $ttcf_face[ $i ] } + $offset_tbl_no_hdr{ $tbl_id };
      $offset = $offset_to_merged_tbl + $offset_tbl_no_hdr{ $tbl_id };
      $tag =~ s,_,/,g;
      syswrite( TTCF, $tag, 4);
      syswrite( TTCF, pack( "NNN", $checkSum, $offset, $length ), 12);
    }
  }
}


foreach $tbl_file ( @SDAT )
{
  $tbl_id = $tbl_path2id{ $tbl_file };
  # printf( STDERR "path=%s -> id=%s -> ", $tbl_file, $tbl_id );
  ( $tag, $length, $checkSum ) = split( /,/, $tbl_id );
  if ( 0 <= $offset_tbl_no_hdr{ $tbl_id } )
  {
    # printf( STDERR " reading %d bytes from %s", $length, $tbl_file );
    printf( STDERR " copy %s @ 0x%08x", $tbl_file, $offset_tbl_no_hdr{ $tbl_id } );
    open( TBL, "$tbl_file" ) || die;
    read( TBL, $_, $length ) || die ;
    syswrite( TTCF, $_, $length ) || die;
    close( TBL ) || die;
    $offset_tbl_no_hdr{ $tbl_id } = 0 - $offset_tbl_no_hdr{ $tbl_id };
  }
  else
  {
    printf( STDERR " ignore %s, reuse preceding table @ 0x%08x", $tbl_file, $offset_tbl_no_hdr{ $tbl_id } );
  }
  printf( STDERR "\n" )
}

close( TTCF ) || die;
