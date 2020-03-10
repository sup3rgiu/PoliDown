"use strict";

const execSync = require('child_process').execSync;
const puppeteer = require("puppeteer");
const term = require("terminal-kit").terminal;
const fs = require("fs");
var https = require('https');
const path = require("path");
const yargs = require("yargs");
var m3u8Parser = require("m3u8-parser");
const request = require('request');
const readline = require("readline");


const argv = yargs.options({
    videoUrls: { type: 'array', demandOption: true },
    username: { type: 'string', demandOption: true, describe: 'Codice Persona PoliMi' },
    password: { type: 'string', demandOption: false },
    outputDirectory: { type: 'string', default: 'videos' }
}).argv;

console.info('Video URLs: %s', argv.videoUrls);
console.info('Username: %s', argv.username);
//console.info('Password: %s', argv.password);
console.info('Output Directory: %s\n', argv.outputDirectory);

function sanityChecks() {
    try {
        const aria2Ver = execSync('aria2c --version').toString().split('\n')[0];
        term.green(`Using ${aria2Ver}\n`);
    }
    catch (e) {
        term.red('You need aria2c in $PATH for this to work. Make sure it is a relatively recent one.');
        process.exit(22);
    }
    try {
        const ffmpegVer = execSync('ffmpeg -version').toString().split('\n')[0];
        term.green(`Using ${ffmpegVer}\n`);
    }
    catch (e) {
        term.red('FFmpeg is missing. You need a fairly recent release of FFmpeg in $PATH.');
        process.exit(23);
    }
    if (!fs.existsSync(argv.outputDirectory)) {
        console.log('Creating output directory: ' +
            process.cwd() + path.sep + argv.outputDirectory);
        fs.mkdirSync(argv.outputDirectory);
    }

}
async function downloadVideo(videoUrls, username, password, outputDirectory) {
   console.log('\nLaunching headless Chrome to perform the OpenID Connect dance...');
   const browser = await puppeteer.launch({
       // Switch to false if you need to login interactively
       headless: true,
       args: ['--disable-dev-shm-usage', '--lang=it-IT']
   });
    if(password === null) { // non è stata passata password come argomento
        const keytar = require('keytar');
        const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            }); 
        var password = {};
        try{
            await keytar.getPassword("PoliDown",username).then(function(result) {password=result;});
        }
        catch(e) {
            await new Promise((fulfill) => {
                rl.question("Impossibile utilizzare keytar; inserire password: ", (result) => {
                    password=result;
                    rl.close();
                    fulfill();
                })
            });
        }
        if (password === null) { // non esiste password salvata precedentemente
            await new Promise((fulfill) => {
                rl.question("Password non salvata. Inserisci password:", (result) => {
                    password=result;
                    rl.close();
                    fulfill();
                })
            });
            await keytar.setPassword("PoliDown",username,password);
        }
    }
   const page = await browser.newPage();
   console.log('Navigating to STS login page...');
   await page.goto(videoUrls[0], { waitUntil: 'networkidle2' });
   await page.waitForSelector('input[type="email"]');
   const usernameEmail = username + "@polimi.it";
   await page.keyboard.type(usernameEmail);
   await page.click('input[type="submit"]');

   console.log('Filling in Servizi Online login form...');
   await page.waitForSelector('input[id="login"]');
   await page.type('input#login', username) // mette il codice persona
   await page.type('input#password', password) // mette la password
   await page.click('button[name="evn_conferma"]') // clicca sul tasto "Accedi"


   try {
     await page.waitForSelector('div[class="Message ErrorMessage"]', { timeout: 1000 });
     term.red('Bad credentials');
     process.exit(401);
   } catch (error) {
      // tutto ok
   }

   try {
     await page.waitForSelector('input[id="idBtn_Back"]', { timeout: 1000 });
     await page.click('input[id="idBtn_Back"]'); // clicca sul tasto "No" per rimanere connessi
   } catch (error) {
      // bottone non apparso, ok...
   }


   await browser.waitForTarget(target => target.url().includes('microsoftstream.com/'), { timeout: 90000 });
   console.log('We are logged in. ');
    for (let videoUrl of videoUrls) {
       term.green(`\nStart downloading video: ${videoUrl}\n`);
       await page.goto(videoUrl, { waitUntil: 'networkidle2' });
       await sleep(2000);

       const cookie = await extractCookies(page);
       console.log('Got required authentication cookies.');
       await sleep(4000);
       console.log('Looking up AMS stream locator...');
       let amp;
       const amsUrl = await page.evaluate(() => { return amp.Player.players["vjs_video_3"].cache_.src; });
       var title = await page.evaluate(
           () => { return document.querySelector(".title").textContent.trim();
       });
       console.log(`\nVideo title is: ${title}`);
       var title = title.replace(/[/\\?%*:|"<>]/g, '-'); // remove illegal characters
       const create_message = await page.evaluate(
           () => { return document.querySelector(".video-create-message .info-message-content").textContent.trim();
       });

       var uploadDate = create_message.match(/(\d{1,4}([.\-\/])\d{1,2}([.\-\/])\d{1,4})/g);
       if (uploadDate !== null) {
           uploadDate = uploadDate[0].replace(/\//g, "_");
            // console.log(uploadDate);
           title = 'Lesson ' + uploadDate + ' - ' + title;
       } else {
            // console.log("no upload date found");
       }

       //console.log('Constructing HLS URL...');
       const hlsUrl = amsUrl.substring(0, amsUrl.lastIndexOf('/')) + '/manifest(format=m3u8-aapl)';

        var tmpDir = videoUrl.substring(videoUrl.indexOf("/video/")+7, videoUrl.length).substring(0, 36); // use the video id (36 character after '/video/') as temp dir name
        var full_tmp_dir = path.join(argv.outputDirectory, tmpDir);

        // creates tmp dir
        if (!fs.existsSync(full_tmp_dir)) {
            fs.mkdirSync(full_tmp_dir);
        } else {
            rmDir(full_tmp_dir);
            fs.mkdirSync(full_tmp_dir);
        }

        var headers = {
            'Cookie': cookie
        };
        var options = {
            url: hlsUrl,
            headers: headers
        };
        var response = await doRequest(options);
        var parser = new m3u8Parser.Parser();
        parser.push(response);
        parser.end();
        var parsedManifest = parser.manifest;
        //console.log(JSON.stringify(parsedManifest, null, 2));

        var playlistsInfo = {};
        var question = '\n';
        var count = 0;
        var audioObj = null;
        var videoObj = null;
        for (var i=0 ; i<parsedManifest['playlists'].length ; i++) {
            if(parsedManifest['playlists'][i]['attributes'].hasOwnProperty('RESOLUTION')) {
                playlistsInfo[i] = {};
                playlistsInfo[i]['resolution'] =  parsedManifest['playlists'][i]['attributes']['RESOLUTION']['width'] + 'x' + parsedManifest['playlists'][i]['attributes']['RESOLUTION']['height'];
                playlistsInfo[i]['uri'] = parsedManifest['playlists'][i]['uri'];
                question = question + '[' + i + '] ' +  playlistsInfo[i]['resolution'] + '\n';
                count = count + 1;
            } else {
                 // if "RESOLUTION" key doesn't exist, means the current playlist is the audio playlist
                 // fix this for multiple audio tracks
                audioObj = parsedManifest['playlists'][i];
            }
        }
        question = question + 'Choose the desired resolution: ';

        var res_choice = await promptResChoice(question, count);
        videoObj = playlistsInfo[res_choice];

        const basePlaylistsUrl = hlsUrl.substring(0, hlsUrl.lastIndexOf("/") + 1);

        // **** VIDEO ****
        var videoLink = basePlaylistsUrl + videoObj['uri'];

        var headers = {
            'Cookie': cookie
        };
        var options = {
            url: videoLink,
            headers: headers
        };

        // *** Get protection key (same key for video and audio segments) ***
        var response = await doRequest(options);
        var parser = new m3u8Parser.Parser();
        parser.push(response);
        parser.end();
        var parsedManifest = parser.manifest;
        const keyUri = parsedManifest['segments'][0]['key']['uri'];
        var options = {
            url: keyUri,
            headers: headers,
            encoding: null
        };
        const key = await doRequest(options);
        const key64 = key.toString('base64');

        // stupid Windows. Need to find a better way. Can't find a way to use a Windows local path for the key URI. So I'm base64-encoding the key. However ffmpeg on Linux doesn't accept this format (???)
        var keyReplacement = '';
        if(process.platform === 'win32') {
            keyReplacement = 'data:text/plain;base64,' + key64;
        } else {
            const local_key_path = path.join(process.cwd(), full_tmp_dir, 'my.key'); // requires absolute path in order to replace the URI inside the m3u8 file
            fs.writeFileSync(local_key_path, key);
            keyReplacement = 'file://' + local_key_path;
        }


        // creates two m3u8 files:
        // - video_full.m3u8: to download all segements (replacing realtive segements path with absolute remote url)
        // - video_tmp.m3u8: used by ffmpeg to merge all downloaded segements (in this one we replace the remote key URI with the absoulte local path of the key downloaded above)
        var baseUri = videoLink.substring(0, videoLink.lastIndexOf("/") + 1);
        var video_full = await response.replace(new RegExp('Fragments', 'g'), baseUri+'Fragments'); // local path to full remote url path
        var video_tmp = await response.replace(keyUri, keyReplacement); // remote URI to local abasolute path (linux/macos) or to base64 string (windows)
        var video_tmp = await video_tmp.replace(new RegExp('Fragments', 'g'), 'video_segments/Fragments');
        const video_full_path = path.join(full_tmp_dir, 'video_full.m3u8');
        const video_tmp_path = path.join(full_tmp_dir, 'video_tmp.m3u8');
        fs.writeFileSync(video_full_path, video_full);
        fs.writeFileSync(video_tmp_path, video_tmp);

        // download async. I'm Speed
        var aria2cCmd = 'aria2c -i ' + video_full_path + ' -j 16 -x 16 -d ' + path.join(full_tmp_dir, 'video_segments') + ' --header="Cookie:' + cookie + '"';
        var result = execSync(aria2cCmd, { stdio: 'inherit' });

        // **** AUDIO ****
        var audioLink = basePlaylistsUrl + audioObj['uri'];
        var options = {
            url: audioLink,
            headers: headers
        };

        // same as above but for audio segements
        var response = await doRequest(options);
        var baseUri = audioLink.substring(0, audioLink.lastIndexOf("/") + 1);
        var audio_full = await response.replace(new RegExp('Fragments', 'g'), baseUri+'Fragments');
        var audio_tmp = await response.replace(keyUri, keyReplacement);
        var audio_tmp = await audio_tmp.replace(new RegExp('Fragments', 'g'), 'audio_segments/Fragments');
        const audio_full_path = path.join(full_tmp_dir, 'audio_full.m3u8');
        const audio_tmp_path = path.join(full_tmp_dir, 'audio_tmp.m3u8');
        fs.writeFileSync(audio_full_path, audio_full);
        fs.writeFileSync(audio_tmp_path, audio_tmp);

        var aria2cCmd = 'aria2c -i ' + audio_full_path + ' -j 16 -x 16 -d ' + path.join(full_tmp_dir, 'audio_segments') + ' --header="Cookie:' + cookie + '"';
        var result = execSync(aria2cCmd, { stdio: 'inherit' });

        // *** MERGE audio and video segements in an mp4 file ***
        if (fs.existsSync(path.join(outputDirectory, title+'.mp4'))) {
            title = title + '-' + Date.now('nano');
        }

        // stupid Windows. Need to find a better way
        var ffmpegCmd = '';
        var ffmpegOpts = {stdio: 'inherit'};
        if(process.platform === 'win32') {
            ffmpegOpts['cwd'] = full_tmp_dir; // change working directory on windows, otherwise ffmpeg doesn't find the segements (relative paths problem, again, stupid windows. Or stupid me?)
            var ffmpegCmd = 'ffmpeg -protocol_whitelist file,http,https,tcp,tls,crypto,data -allowed_extensions ALL -i ' + 'audio_tmp.m3u8' + ' -protocol_whitelist file,http,https,tcp,tls,crypto,data -allowed_extensions ALL -i ' + 'video_tmp.m3u8' + ' -async 1 -c copy -bsf:a aac_adtstoasc -n "' + path.join('..', '..', outputDirectory, title) + '.mp4"';
        } else {
            var ffmpegCmd = 'ffmpeg -protocol_whitelist file,http,https,tcp,tls,crypto -allowed_extensions ALL -i ' + audio_tmp_path + ' -protocol_whitelist file,http,https,tcp,tls,crypto -allowed_extensions ALL -i ' + video_tmp_path + ' -async 1 -c copy -bsf:a aac_adtstoasc -n "' + path.join(outputDirectory, title) + '.mp4"';
        }

        var result = execSync(ffmpegCmd, ffmpegOpts);

        // remove tmp dir
        rmDir(full_tmp_dir);


    }

    console.log("\nAt this point Chrome's job is done, shutting it down...");
    await browser.close();
    term.green(`Done!\n`);

}

function doRequest(options) {
  return new Promise(function (resolve, reject) {
    request(options, function (error, res, body) {
      if (!error && res.statusCode == 200) {
        resolve(body);
      } else {
        reject(error);
      }
    });
  });
}

function promptResChoice(question, count) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
     output: process.stdout
  });

  return new Promise(function(resolve, reject) {
    var ask = function() {
      rl.question(question, function(answer) {
          if (!isNaN(answer) && parseInt(answer) < count && parseInt(answer) >= 0) {
            resolve(parseInt(answer), reject);
            rl.close();
          } else {
            console.log("\n* Wrong * - Please insert a number between 0 and " + (count-1) + "\n");
            ask();
        }
      });
    };
    ask();
  });
}


function rmDir(dir, rmSelf) {
    var files;
    rmSelf = (rmSelf === undefined) ? true : rmSelf;
    dir = dir + "/";
    try { files = fs.readdirSync(dir); } catch (e) { console.log("!Oops, directory not exist."); return; }
    if (files.length > 0) {
        files.forEach(function(x, i) {
            if (fs.statSync(dir + x).isDirectory()) {
                rmDir(dir + x);
            } else {
                fs.unlinkSync(dir + x);
            }
        });
    }
    if (rmSelf) {
        // check if user want to delete the directory or just the files in this directory
        fs.rmdirSync(dir);
    }
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractCookies(page) {
    var jar = await page.cookies("https://.api.microsoftstream.com");
    var authzCookie = jar.filter(c => c.name === 'Authorization_Api')[0];
    var sigCookie = jar.filter(c => c.name === 'Signature_Api')[0];
    if (authzCookie == null || sigCookie == null) {
        await sleep(5000);
        var jar = await page.cookies("https://.api.microsoftstream.com");
        var authzCookie = jar.filter(c => c.name === 'Authorization_Api')[0];
        var sigCookie = jar.filter(c => c.name === 'Signature_Api')[0];
    }
    if (authzCookie == null || sigCookie == null) {
        console.error('Unable to read cookies. Try launching one more time, this is not an exact science.');
        process.exit(88);
    }
    return `Authorization=${authzCookie.value}; Signature=${sigCookie.value}`;
}

term.brightBlue(`Project originally based on https://github.com/snobu/destreamer\nFork powered by @sup3rgiu\nImprovements: PoliMi Autologin - Multithreading download (much faster) - Video Quality Choice\n`);
sanityChecks();
if (typeof argv.password === 'undefined') downloadVideo(argv.videoUrls, argv.username, null, argv.outputDirectory); // caso in cui non viene passata password come arg
else downloadVideo(argv.videoUrls, argv.username, argv.password, argv.outputDirectory);
