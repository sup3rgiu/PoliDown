"use strict";

const execSync = require('child_process').execSync;
const puppeteer = require("puppeteer");
const term = require("terminal-kit").terminal;
const fs = require("fs");
const path = require("path");
const yargs = require("yargs");

const argv = yargs.options({
    videoUrls: { type: 'array', demandOption: true },
    username: { type: 'string', demandOption: true },
    password: { type: 'string', demandOption: true },
    outputDirectory: { type: 'string', default: 'videos' }
}).argv;

console.info('Video URLs: %s', argv.videoUrls);
console.info('Username: %s', argv.username);
console.info('Password: %s', argv.password);
console.info('Output Directory: %s\n', argv.outputDirectory);

function sanityChecks() {
    try {
        const ytdlVer = execSync('youtube-dl --version');
        term.green(`Using youtube-dl version ${ytdlVer}`);
    }
    catch (e) {
        console.error('You need youtube-dl in $PATH for this to work. Make sure it is a relatively recent one, baked after 2019.');
        process.exit(22);
    }
    try {
        const ffmpegVer = execSync('ffmpeg -version')
            .toString().split('\n')[0];
        term.green(`Using ${ffmpegVer}\n`);
    }
    catch (e) {
        console.error('FFmpeg is missing. You need a fairly recent release of FFmpeg in $PATH.');
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
        args: ['--disable-dev-shm-usage']
    });
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
        await page.goto(videoUrl, { waitUntil: 'networkidle2' });
        await sleep(2000);

        const cookie = await extractCookies(page);
        console.log('Got required authentication cookies.');
        await sleep(4000);
        console.log('Looking up AMS stream locator...');
        let amp;
        const amsUrl = await page.evaluate(() => { return amp.Player.players["vjs_video_3"].cache_.src; });
        const title = await page.evaluate(
            () => { return document.querySelector(".title").textContent.trim();
        });
        console.log(`Video title is: ${title}`);
        console.log('Constructing HLS URL...');
        const hlsUrl = amsUrl.substring(0, amsUrl.lastIndexOf('/')) + '/manifest(format=m3u8-aapl)';
        console.log('Spawning youtube-dl with cookies and HLS URL...\n');
        const youtubedlCmd = 'youtube-dl --no-call-home --no-warnings ' +
            `--output "${outputDirectory}/${title}.mp4" --add-header Cookie:"${cookie}" "${hlsUrl}"`;

        var result = execSync(youtubedlCmd, { stdio: 'inherit' });
    }
    console.log("At this point Chrome's job is done, shutting it down...");
    term.green(`Done!`);
    await browser.close();
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

term.brightBlue(`Project based on https://github.com/snobu/destreamer\nFork powered by @sup3rgiu\n`);
sanityChecks();
downloadVideo(argv.videoUrls, argv.username, argv.password, argv.outputDirectory);
