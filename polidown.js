"use strict";

const execSync = require('child_process').execSync;
const puppeteer = require("puppeteer");
const term = require("terminal-kit").terminal;
const fs = require("fs");
var https = require('https');
const url = require('url');
const path = require("path");
const yargs = require("yargs");
var m3u8Parser = require("m3u8-parser");
const request = require('request');


const demandOneOfOption = (...options) => (argv) => {
    const count = options.filter(option => argv[option]).length;
    const lastOption = options.pop();
  
    if (count === 0) {
      throw new Error(`Exactly one of the arguments ${options.join(', ')} and ${lastOption} is required`);
    }
    else if (count > 1) {
      throw new Error(`Arguments ${options.join(', ')} and ${lastOption} are mutually exclusive`);
    }
  
    return true;
};

const argv = yargs.options({
    v: { alias:'videoUrls', type: 'array', demandOption: false },
    f: { alias:'filePage', type: 'string', demandOption: false },
    u: { alias:'username', type: 'string', demandOption: true, describe: 'Codice Persona PoliMi' },
    p: { alias:'password', type: 'string', demandOption: false },
    o: { alias:'outputDirectory', type: 'string', default: 'videos' },
    q: { alias: 'quality', type: 'number', demandOption: false, describe: 'Video Quality [0-5]'},
    k: { alias: 'noKeyring', type: 'boolean', default: false, demandOption: false, describe: 'Do not use system keyring'}
})
.help('h')
.alias('h', 'help')
.example('node $0 -u CODICEPERSONA -v "https://web.microsoftstream.com/video/9611baf5-b12e-4782-82fb-b2gf68c05adc"\n', "Standard usage")
.example('node $0 -u CODICEPERSONA -v "https://web.microsoftstream.com/video/9611baf5-b12e-4782-82fb-b2gf68c05adc" "https://web.microsoftstream.com/video/6711baa5-c56e-4782-82fb-c2ho68c05zde"\n', "Multiple videos download")
.example('node $0 -u CODICEPERSONA -v "https://web.microsoftstream.com/video/9611baf5-b12e-4782-82fb-b2gf68c05adc" -q 4\n', "Define default quality download to avoid manual prompt")
.example('node $0 -u CODICEPERSONA -v "https://web.microsoftstream.com/video/9611baf5-b12e-4782-82fb-b2gf68c05adc" -o "C:\\Lessons\\Videos"\n', "Define output directory (absoulte o relative path)")
.example('node $0 -u CODICEPERSONA -v "https://web.microsoftstream.com/video/9611baf5-b12e-4782-82fb-b2gf68c05adc" -k\n', "Do not save the password into system keyring")
.conflicts('v', 'f')
.check(demandOneOfOption('v', 'f'))
.argv;

console.info('Video URLs: %s', argv.videoUrls);
console.info('Html page: %s', argv.filePage);
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
        term.green(`Using ${ffmpegVer}\n\n`);
    }
    catch (e) {
        term.red('FFmpeg is missing. You need a fairly recent release of FFmpeg in $PATH.');
        process.exit(23);
    }
    if (!fs.existsSync(argv.outputDirectory)) {
        if (path.isAbsolute(argv.outputDirectory) || argv.outputDirectory[0] == '~') console.log('Creating output directory: ' + argv.outputDirectory);
        else console.log('Creating output directory: ' + process.cwd() + path.sep + argv.outputDirectory);
        try {
          fs.mkdirSync(argv.outputDirectory, { recursive: true }); // use native API for nested directory. No recursive function needed, but compatible only with node v10 or later
        } catch (e) {
          term.red("Can not create nested directories. Node v10 or later is required\n");
          process.exit();
        }
    }

}
async function downloadVideo(videoUrls, username, password, outputDirectory) {

   // handle password
   const keytar = require('keytar');
   //keytar.deletePassword('PoliDown', username);
   if(password === null) { // password not passed as argument
        var password = {};
        if(argv.noKeyring === false) {
          try {
              await keytar.getPassword("PoliDown", username).then(function(result) { password = result; });
              if (password === null) { // no previous password saved
                  password = await promptQuestion("Password not saved. Please enter your password, PoliDown will not ask for it next time: ");
                  await keytar.setPassword("PoliDown", username, password);
              } else {
                  console.log("Reusing password saved in system's keychain!")
              }
          }
          catch(e) {
              console.log("X11 is not installed on this system. PoliDown can't use keytar to save the password.")
              password = await promptQuestion("No problem, please manually enter your password: ");
          }
        } else {
          password = await promptQuestion("Please enter your password: ");
        }
   } else {
      if(argv.noKeyring === false) {
        try {
            await keytar.setPassword("PoliDown", username, password);
            console.log("Your password has been saved. Next time, you can avoid entering it!");
        } catch(e) {
            // X11 is missing. Can't use keytar
        }
      }
   }
   console.log('\nLaunching headless Chrome to perform the OpenID Connect dance...');
   const browser = await puppeteer.launch({
       // Switch to false if you need to login interactively
       headless: true,
       args: ['--disable-dev-shm-usage', '--lang=it-IT']
   });

   const page = await browser.newPage();
   console.log('Navigating to STS login page...');
   await page.goto('https://web.microsoftstream.com/', { waitUntil: 'networkidle2' });
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
       await page.waitForSelector('button[name="evn_continua"]', { timeout: 1000 }); // password is expiring
       await page.click('button[name="evn_continua"]');
   } catch (error) {
       // password is not expiring
   }

   try {
     await page.waitForSelector('input[id="idBtn_Back"]', { timeout: 2000 });
     await page.click('input[id="idBtn_Back"]'); // clicca sul tasto "No" per rimanere connessi
   } catch (error) {
      // bottone non apparso, ok...
   }


   await browser.waitForTarget(target => target.url().includes('microsoftstream.com/'), { timeout: 90000 });
   console.log('We are logged in. ');
   await sleep (3000)
   const cookie = await extractCookies(page);
   console.log('Got required authentication cookies.');
    for (let videoUrl of videoUrls) {
       term.green(`\nStart downloading video: ${videoUrl}\n`);

       var videoID = videoUrl.substring(videoUrl.indexOf("/video/")+7, videoUrl.length).substring(0, 36); // use the video id (36 character after '/video/') as temp dir name
       var full_tmp_dir = path.join(argv.outputDirectory, videoID);

       var headers = {
           'Cookie': cookie
       };

       var options = {
           url: 'https://euwe-1.api.microsoftstream.com/api/videos/'+videoID+'?api-version=1.0-private',
           headers: headers
       };
       var response = await doRequest(options);
       const obj = JSON.parse(response);

       if(obj.hasOwnProperty('error')) {
         let errorMsg = ''
         if(obj.error.code === 'Forbidden') {
           errorMsg = 'You are not authorized to access this video.\n'
         } else {
           errorMsg = '\nError downloading this video.\n'
         }
         term.red(errorMsg)
         continue;
       }

       // creates tmp dir
       if (!fs.existsSync(full_tmp_dir)) {
           fs.mkdirSync(full_tmp_dir);
       } else {
           rmDir(full_tmp_dir);
           fs.mkdirSync(full_tmp_dir);
       }

       var title = (obj.name).trim();
       console.log(`\nVideo title is: ${title}`);
       title = title.replace(/[/\\?%*:;|"<>]/g, '-'); // remove illegal characters
       var isoDate = obj.publishedDate;
       if (isoDate !== null && isoDate !== '') {
          let date = new Date(isoDate);
          let year = date.getFullYear();
          let month = date.getMonth()+1;
          let dt = date.getDate();

          if (dt < 10) {
            dt = '0' + dt;
          }
            if (month < 10) {
            month = '0' + month;
          }
          let uploadDate = dt + '_' + month + '_' + year;
          title = 'Lesson ' + uploadDate + ' - ' + title;
       } else {
            // console.log("no upload date found");
       }

      let playbackUrls = obj.playbackUrls
      let hlsUrl = ''
      for(var elem in playbackUrls) {
          if(playbackUrls[elem]['mimeType'] === 'application/vnd.apple.mpegurl') {
            var u = url.parse(playbackUrls[elem]['playbackUrl'], true);
            hlsUrl = u.query.playbackurl
            break;
          }
      }

        var options = {
            url: hlsUrl,
        };
        var response = await doRequest(options);
        var parser = new m3u8Parser.Parser();
        parser.push(response);
        parser.end();
        var parsedManifest = parser.manifest;

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
        //  if quality is passed as argument use that, otherwise prompt
        if (typeof argv.quality === 'undefined') {
            question = question + 'Choose the desired resolution: ';
            var res_choice = await promptResChoice(question, count);
        }
        else {
          if(argv.quality < 0 || argv.quality > count-1) {
            term.yellow(`Desired quality is not available for this video (available range: 0-${count-1})\nI'm going to use the best resolution available: ${playlistsInfo[count-1]['resolution']}`);
            var res_choice = count-1;
          }
          else {
            var res_choice = argv.quality;
            term.yellow(`Selected resolution: ${playlistsInfo[res_choice]['resolution']}`);
          }
        }

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

        var keyReplacement = '';
        if (path.isAbsolute(full_tmp_dir) || full_tmp_dir[0] == '~') { // absolute path
            var local_key_path = path.join(full_tmp_dir, 'my.key');
        }
        else {
            var local_key_path = path.join(process.cwd(), full_tmp_dir, 'my.key'); // requires absolute path in order to replace the URI inside the m3u8 file
        }
        fs.writeFileSync(local_key_path, key);
        if(process.platform === 'win32') {
          keyReplacement = await 'file:' + local_key_path.replace(/\\/g, '/');
        } else {
          keyReplacement = 'file://' + local_key_path;
        }


        // creates two m3u8 files:
        // - video_full.m3u8: to download all segements (replacing realtive segements path with absolute remote url)
        // - video_tmp.m3u8: used by ffmpeg to merge all downloaded segements (in this one we replace the remote key URI with the absoulte local path of the key downloaded above)
        var baseUri = videoLink.substring(0, videoLink.lastIndexOf("/") + 1);
        var video_full = await response.replace(new RegExp('Fragments', 'g'), baseUri+'Fragments'); // local path to full remote url path
        var video_tmp = await response.replace(keyUri, keyReplacement); // remote URI to local abasolute path
        var video_tmp = await video_tmp.replace(new RegExp('Fragments', 'g'), 'video_segments/Fragments');
        const video_full_path = path.join(full_tmp_dir, 'video_full.m3u8');
        const video_tmp_path = path.join(full_tmp_dir, 'video_tmp.m3u8');
        fs.writeFileSync(video_full_path, video_full);
        fs.writeFileSync(video_tmp_path, video_tmp);

        // download async. I'm Speed
        var aria2cCmd = 'aria2c -i "' + video_full_path + '" -j 16 -x 16 -d "' + path.join(full_tmp_dir, 'video_segments') + '" --header="Cookie:' + cookie + '"';
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

        var aria2cCmd = 'aria2c -i "' + audio_full_path + '" -j 16 -x 16 -d "' + path.join(full_tmp_dir, 'audio_segments') + '" --header="Cookie:' + cookie + '"';
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
            var outputFullPath = '';
            if (path.isAbsolute(outputDirectory) || outputDirectory[0] == '~')
              outputFullPath = path.join(outputDirectory, title);
            else
              outputFullPath = path.join('..', '..', outputDirectory, title);
            var ffmpegCmd = 'ffmpeg -protocol_whitelist file,http,https,tcp,tls,crypto,data -allowed_extensions ALL -i ' + 'audio_tmp.m3u8' + ' -protocol_whitelist file,http,https,tcp,tls,crypto,data -allowed_extensions ALL -i ' + 'video_tmp.m3u8' + ' -async 1 -c copy -bsf:a aac_adtstoasc -n "' + outputFullPath + '.mp4"';
        } else {
            var ffmpegCmd = 'ffmpeg -protocol_whitelist file,http,https,tcp,tls,crypto -allowed_extensions ALL -i "' + audio_tmp_path + '" -protocol_whitelist file,http,https,tcp,tls,crypto -allowed_extensions ALL -i "' + video_tmp_path + '" -async 1 -c copy -bsf:a aac_adtstoasc -n "' + path.join(outputDirectory, title) + '.mp4"';
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
      if (!error && (res.statusCode == 200 || res.statusCode == 403)) {
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
            console.log("\n* Wrong * - Please enter a number between 0 and " + (count-1) + "\n");
            ask();
        }
      });
    };
    ask();
  });
}

function promptQuestion(question) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
     output: process.stdout
  });

  return new Promise(function(resolve, reject) {
    var ask = function() {
      rl.question(question, function(answer) {
            resolve(answer, reject);
            rl.close();
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

function extractUrls(filePage){
    var text 
    try{ text = fs.readFileSync(filePage) } catch(e){ console.log("!Oops, can't open the file: " + filePage); process.exit(); }
    text = text.toString();

    var re = /\/video\/.{36}/g;
    var urls = text.match(re);

    if(urls === null){
        console.log("!No valid url found in file: " + filePage);
        process.exit();
    }

    // remove duplicates
    urls = Array.from(new Set(urls))

    console.log("Found " + urls.length + " urls in file: ");
    for(var i = 0; i<urls.length; i++)
        console.log(urls[i]);
    console.log();              // pretty printing

    return urls;
}


term.brightBlue(`Project originally based on https://github.com/snobu/destreamer\nFork powered by @sup3rgiu\nImprovements: PoliMi Autologin - Multithreading download (much faster) - Video Quality Choice\n`);
sanityChecks();

if (typeof argv.filePage !== 'undefined')
    argv.videoUrls = extractUrls(argv.filePage);

if (typeof argv.password === 'undefined') downloadVideo(argv.videoUrls, argv.username, null, argv.outputDirectory);
else downloadVideo(argv.videoUrls, argv.username, argv.password, argv.outputDirectory);
