Music Generator
===============

Algorithmically generate music on the terminal

### Watch on YouTube

**I Made a Computer Program to Generate Piano Music**

[![Code Deep Dive](https://img.youtube.com/vi/v4oRZaSU5E0/hqdefault.jpg)](https://youtu.be/v4oRZaSU5E0)

**5 HOURS of ALGORITHMICALLY GENERATED Piano Music**

[![5 Hours](https://img.youtube.com/vi/rUKQYtI4Yaw/hqdefault.jpg)](https://youtu.be/rUKQYtI4Yaw)

Install
-------

``` console
git clone git://github.com/bahamas10/music-generator
cd music-generator
npm install
```

Example
-------

``` console
$ ./bin/music-generator AABA > foo.mid
$ file foo.mid
foo.mid: Standard MIDI data (format 1) using 2 tracks at 1/128
```

Usage
-----

``` console
$ ./bin/music-generator -h
Usage: music-generator [options] <pattern> > out.mid

Example:
  music-generator AABA > foo.mid

Options
  -b, --bpm <num>                     bpm, defaults to 60
  -B, --beats-per-bar <num>           beats per bar (like time signature), defaults to 4
  -h, --help                          print this message and exit
  -L, --left-hand-range <num-num>     pitch range for the left hand, defaults to 0-14
  -r, --root <num>                    left hand root, defaults to 7
  -R, --right-hand-range <num-num>    pitch range for the right hand, defaults to 14-28
  -s, --sustain                       enable the sustain pedal, defaults to false
  -S, --section-lengths <left,right>  number of bars per section, defaults to 4,8
  -t, --transpose <num>               amount to transpose the song, defaults to 12
  -V, --velocity-range <num-num>      velocity range for each note, defaults to 25-42
```

License
-------

MIT License
