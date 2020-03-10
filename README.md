# PoliDown

## Saves Microsoft Stream videos uploaded by Politecnico di Milano.

This project was originally based on https://github.com/snobu/destreamer

Improvements in this fork:
 - PoliMi autologin
 - Multithreading download through aria2c
 - Possibility to choose the video resolution


## PREREQS

* [**Node.js**](https://nodejs.org/it/download/): anything above v8.0 seems to work.
* [NO MORE REQUIRED]~~[**youtube-dl**](https://ytdl-org.github.io/youtube-dl/download.html): you'll need a fairly recent version that understands encrypted HLS streams. This needs to be in your `$PATH` (for example, copy youtube-dl.exe to c:\windows). PoliDown calls `youtube-dl` with a bunch of arguments.~~
* [**aria2**](https://github.com/aria2/aria2/releases): this needs to be in your `$PATH` (for example, copy aria2c.exe to c:\windows). PoliDown calls `aria2c` with a bunch of arguments in order to improve the download speed.
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
Project originally based on https://github.com/snobu/destreamer
Fork powered by @sup3rgiu
Improvements: PoliMi Autologin - Multithreading download (much faster) - Video Quality Choice
Using aria2 version 1.35.0
Using ffmpeg version git-2020-03-06-cfd9a65 Copyright (c) 2000-2020 the FFmpeg developers

Launching headless Chrome to perform the OpenID Connect dance...
Navigating to STS login page...
Filling in Servizi Online login form...
We are logged in.

Start downloading video: https://web.microsoftstream.com/video/d1e6c909-3189-488f-8172-e88947249f02
Got required authentication cookies.
Looking up AMS stream locator...

Video title is: SALIONI ALBERTO  088805-FISICA TECNICA (712804)

[0] 320x180
[1] 480x270
[2] 640x360
[3] 960x540
[4] 1280x720
[5] 1920x1080
Choose the desired resolution: 5

03/10 20:47:14 [NOTICE] Downloading 898 item(s)

[...]

At this point Chrome's job is done, shutting it down...
Done!
```

The video is now saved under `videos/`, or whatever the `outputDirectory` argument points to.
