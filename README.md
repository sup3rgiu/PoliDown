# PoliDown

## SOON: multi-thread download. Stay tuned!

## Saves Microsoft Stream videos uploaded by Politecnico di Milano.

This project is based on https://github.com/snobu/destreamer


## PREREQS

* [**Node.js**](https://nodejs.org/it/download/): anything above v8.0 seems to work.
* [**youtube-dl**](https://ytdl-org.github.io/youtube-dl/download.html): you'll need a fairly recent version that understands encrypted HLS streams. This needs to be in your `$PATH` (for example, copy youtube-dl.exe to c:\windows). PoliDown calls `youtube-dl` with a bunch of arguments.
* [**ffmpeg**](https://www.ffmpeg.org/download.html): a recent version (year 2019 or above), in [`$PATH`](https://www.thewindowsclub.com/how-to-install-ffmpeg-on-windows-10).


## USAGE

* Clone this repo
* `cd` into the cloned folder
* `npm install` to install dependencies


```
$ node polidown.js

Options:
  --help             Show help                                         [boolean]
  --version          Show version number                               [boolean]
  --videoUrls                                                 [array] [required]
  --username         Codice Persona PoliMi                   [string] [required]
  --password                                                 [string] [required]
  --outputDirectory                                 [string] [default: "videos"]


$ node polidown.js --username CODICEPERSONA --password PASSWORD --outputDirectory "videos" \
    --videoUrls "https://web.microsoftstream.com/video/VIDEO-1" \
                "https://web.microsoftstream.com/video/VIDEO-2" \
                "https://web.microsoftstream.com/video/VIDEO-3"
```
You can use an absolute path for `--outputDirectory`.

## EXPECTED OUTPUT

```
Project based on https://github.com/snobu/destreamer
Fork powered by @sup3rgiu
Using youtube-dl version 2020.03.06
Using ffmpeg version git-2020-03-06-cfd9a65 Copyright (c) 2000-2020 the FFmpeg developers

Launching headless Chrome to perform the OpenID Connect dance...
Navigating to STS login page...
Filling in Servizi Online login form...
We are logged in.
Got required authentication cookies.
Looking up AMS stream locator...
Video title is: SILVANO CRISTINA 088949-ADVANCED COMPUTER ARCHITECTURES (712741)
Constructing HLS URL...
Spawning youtube-dl with cookies and HLS URL...

[generic] manifest(format=m3u8-aapl): Requesting header
[generic] manifest(format=m3u8-aapl): Downloading m3u8 information
[download] videos\SILVANO CRISTINA 088949-ADVANCED COMPUTER ARCHITECTURES (712741).mp4

[...]

At this point Chrome's job is done, shutting it down...
Done!
```

The video is now saved under `videos/`, or whatever the `outputDirectory` argument points to.
