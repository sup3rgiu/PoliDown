# PoliDown

## Saves Microsoft Stream videos uploaded by Politecnico di Milano.

This project was originally based on https://github.com/snobu/destreamer

Improvements in this fork:
 - PoliMi autologin
 - Multithreading download through aria2c
 - Possibility to choose the video resolution


## PREREQS

* [**Node.js**](https://nodejs.org/it/download/): anything above v8.0 seems to work.
* **[NO MORE REQUIRED]** ~~[**youtube-dl**](https://ytdl-org.github.io/youtube-dl/download.html): you'll need a fairly recent version that understands encrypted HLS streams. This needs to be in your `$PATH` (for example, copy youtube-dl.exe to c:\windows). PoliDown calls `youtube-dl` with a bunch of arguments.~~
* [**aria2**](https://github.com/aria2/aria2/releases): this needs to be in your `$PATH` (for example, copy aria2c.exe to c:\windows). PoliDown calls `aria2c` with a bunch of arguments in order to improve the download speed.
* [**ffmpeg**](https://www.ffmpeg.org/download.html): a recent version (year 2019 or above), in [`$PATH`](https://www.thewindowsclub.com/how-to-install-ffmpeg-on-windows-10).

## Windows Installation instructions
(On others OS is pretty much the same)\
**N.B:** ffmpeg.zeranoe.com closed since Sep 18, 2020. If you are following the video tutorial, download ffmpeg from another source available on [ffmpeg site](https://www.ffmpeg.org/download.html) (nightly build is no more required)

[![https://user-images.githubusercontent.com/7725068/76635047-21a89080-6547-11ea-8da9-31831ca7620a.png](https://user-images.githubusercontent.com/7725068/76635345-a1cef600-6547-11ea-991b-d115946ed556.png)](http://www.youtube.com/watch?v=iZgea4t5YW4 "PoliDown Windows Installation Instructions")


## USAGE

* Clone this repo
* `cd` into the cloned folder
* `npm install` to install dependencies

### COMMAND LINE USAGE

Default usage:
```
$ node polidown.js --username CODICEPERSONA --videoUrls "https://web.microsoftstream.com/video/VIDEO-1"

$ node polidown.js -u CODICEPERSONA -v "https://web.microsoftstream.com/video/VIDEO-1"
```

Show options:
```
$ node polidown.js -h

Options:
  --version              Show version number                           [boolean]
  -v, --videoUrls                                             [array] [required]
  -f, --videoUrlsFile    Path to txt file containing the URLs (one URL for each line) [string]
  -u, --username         Codice Persona PoliMi               [string] [required]
  -p, --password                                                        [string]
  -o, --outputDirectory                             [string] [default: "videos"]
  -q, --quality          Video Quality [0-5]                            [number]
  -k, --noKeyring        Do not use system keyring    [boolean] [default: false]
  -h, --help             Show help                                     [boolean]
```

Multiple videos download:
```
$ node polidown.js -u CODICEPERSONA
    -v "https://web.microsoftstream.com/video/VIDEO-1"
                "https://web.microsoftstream.com/video/VIDEO-2"
                "https://web.microsoftstream.com/video/VIDEO-3"
```

Download from TXT file (one link each line):
```
$ node polidown.js -u CODICEPERSONA -f "/my/path/here/links.txt"
```

Define default video quality [0-5] (avoid manual prompt for each video):
```
$ node polidown.js -u CODICEPERSONA -v "https://web.microsoftstream.com/video/VIDEO-1" -q 4
```

Output directory (relative or absoulte path):
```
$ node polidown.js -u CODICEPERSONA -v "https://web.microsoftstream.com/video/VIDEO-1" -o "/my/path/here"
```

Replace saved password
```
$ node polidown.js -u CODICEPERSONA -p MYNEWPASSWORD -v "https://web.microsoftstream.com/video/VIDEO-1"
```

Do not use system keyring to save the password:
```
$ node polidown.js -u CODICEPERSONA -v "https://web.microsoftstream.com/video/VIDEO-1" -k
```


You can omit the password argument. PoliDown will ask for it interactively and then save it securely in system's keychain for the next use.

### SCRIPT USAGE

Fill in the required fields in the `.sh` \ `.bat` script (according to your OS: `.sh` for MacOS/Linux, `.bat` for Windows).

Example (Windows):
```
@echo off
rem Put your settings in place of the dots
rem Remember! Assignment is space-sensitive!
 
set polidown_folder_path="C:\MyFolder\AnotherFolder\PoliDown"
set codice_persona=10026431
set urls_file_path="C:\Users\supergiu\Desktop\links.txt"
set output_folder_path="C:\Users\supergiu\Desktop"
set quality_number=4

cd /D %polidown_folder_path%
node polidown.js -u %codice_persona% -f %urls_file_path% -o %output_folder_path% -q %quality_number%
@echo.
@echo Press any key to terminate . . .
@pause >nul
```

Then:
* for Windows, double click on the `.bat` script and enjoy
* for MacOS/Linux, `.sh` script needs to be made executable (`chmod 777` command or just set properly flag in file properties). Then, run it with Terminal

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
