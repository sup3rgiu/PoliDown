# PoliDown

## Saves Microsoft Stream videos uploaded by Politecnico di Milano.

This project is based on https://github.com/snobu/destreamer


## PREREQS

* **Node.js**: anything above v8.0 seems to work. A GitHub Action runs tests on Node 8, 10 and 12 on every commit.
* **youtube-dl**: https://ytdl-org.github.io/youtube-dl/download.html, you'll need a fairly recent version that understands encrypted HLS streams. This needs to be in your `$PATH`. PoliDown calls `youtube-dl` with a bunch of arguments.
* **ffmpeg**: a recent version (year 2019 or above), in `$PATH`.


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
  --username                                                 [string] [required]
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
Using ffmpeg version N-92953-gad0d5d7516 Copyright (c) 2000-2019 the FFmpeg developers

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
