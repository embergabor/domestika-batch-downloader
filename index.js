const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const m3u8ToMp4 = require('m3u8-to-mp4');
const fs = require('fs');
const fsPromises = require('fs').promises;
const converter = new m3u8ToMp4();
const fetch = require("node-fetch");

const debug = false;
const debug_data = [];

const session= '5jPt%2FfugtvjPfAyucfu06rK4ltwptKwsgiZBi3%2F%2FryM5xfKA4spU9NXTH78jWfV2CrlvC3%2BVK4Srm2ABQn70bbAjOnCyPsn2Hiyk%2BLNq%2B7sM9QYQMqOSPI6BhepQKVctaZOjbJYFjnnQSJl0zIUXXJyut%2FrPMyh%2FxNVPF3PF0Y5tyNvIg4Gmoiyv6KJZv65aSOGivfNgEIucosDVOG%2FqSdbq7sqxqzp3GUAgcRwXTrVY1YvbNpAbfFp1z%2BFiOefBmSd%2B7VgiUVTjXKkqH9ET2fClpCjqAbrlXMog%2F6lhaMNZU2NryEEfd46p%2BuJKM3EN0ZLmY5V%2FqbDERhojr61Xvl6ofRB9OAOUp1zV4k7C5Vz7AkbbUesnDEnBqvFBTg94gxgqEjylWQnwpT1kFZMPUvKH0%2BVDohGfMQoY1W4NW7QtMJp5amb1kd6mTeHqBih%2FwUKOrbysAUITxoT1%2FlQwbjbiZ0pFXbAAGJ6BbQthRaOwLJlL0N83TZg%2FhmchOo5FZwIHg27ZpsAHLTyC4jmqMLgCaG5FnlXTV7kvIgGUCK8z3WSPRUXDXTlWZFhDkCRthAw7Uv4DuqoxM%2BRxNTsq%2FokLNlq6TPmO7bg1flSiirb1bTEl6HdGTNfGZttafnpClWtMtuLwB5siOca6QQZ3vvrxtLTz3IaYept2MJvWINkRYKXAkn9479nUg5hKP%2FYSjuT5PTPGmPoFuSLq2Ktkk1V5WKQFmw%3D%3D--Cb7abO2sX%2FYvsktt--Aoe1PXnLF%2BWOL6BjXa8MXg%3D%3D';


//Credentials needed for the access token to get the final project
const _credentials_ = '{%22accessToken%22:%22pOEcPRTn98yDyT9hOc5jSnHgslssDF8iJr-iL5xR3pQ%22%2C%22refreshToken%22:%22c8G-e1z__PHa7bsC3CENKxzOKRAiXiZjBmY-z7VeOpc%22%2C%22isEmpty%22:false}';


const subtitle_lang = 'en';

//Cookie used to retreive video information
const cookies = [
    {
        name: '_domestika_session',
        value: session,
        domain: 'www.domestika.org',
    },
];


//Check if the N_m3u8DL-RE.exe exists, throw error if not
if (fs.existsSync('N_m3u8DL-RE')) {
    downloadCourses();
} else {
    throw Error('N_m3u8DL-RE.exe not found! Download the Binary here: https://github.com/nilaoda/N_m3u8DL-RE/releases');
}

async function asyncReadFile(filename) {
    try {
        const contents = await fsPromises.readFile(filename, 'utf-8');

        const arr = contents.split(/\r?\n/);

        //console.log(arr); // 👉️ ['One', 'Two', 'Three', 'Four']
        console.log(arr.length + " course URLs found");

        return arr;
    } catch (err) {
        console.log(err);
    }
}

async function downloadCourses() {
    const course_urls = await asyncReadFile("input.txt");
    for(const course of course_urls) {
        console.log(course);
        await scrapeSite(course);
    }
}

async function scrapeSite(course_url) {
    //Scrape site for links to videos
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setCookie(...cookies);
    await page.goto(course_url);
    const html = await page.content();
    const $ = cheerio.load(html);

    let allVideos = [];

    let units = $('h4.h2.unit-item__title a');

    let title = $('h1.course-header-new__title')
        .text()
        .trim()
        .replace(/[/\\?%*:'|"<>]/g, '').replaceAll(" ","_");

    let totalVideos = 1;

    //Get all the links to the m3u8 files
    for (let i = 0; i < units.length - 1; i++) {
        let videoData = await getInitialProps($(units[i]).attr('href'));
        allVideos.push({
            title: $(units[i])
                .text()
                .trim()
                .replace(/[/\\?%*:'|"<>]/g, '').replaceAll(" ","_"),
            videoData: videoData,
        });

        totalVideos += videoData.length;
    }

    //Get access token from the credentials
    let access_token = decodeURI(_credentials_);
    let regex_token = /accessToken\":\"(.*?)\"/gm;
    access_token = regex_token.exec(access_token)[1];

    let regex_final = /courses\/(.*?)-/gm;
    let final_project_id = regex_final.exec($(units[units.length - 1]).attr('href'))[1];
    let final_data = await fetchFromApi(`https://api.domestika.org/api/courses/${final_project_id}/final-project?with_server_timing=true`, 'finalProject.v1', access_token);
    final_project_id = final_data.data.relationships.video.data.id;
    final_data = await fetchFromApi(`https://api.domestika.org/api/videos/${final_project_id}?with_server_timing=true`, 'video.v1', access_token);

    allVideos.push({
        title: 'U9-Final_project',
        videoData: [{ playbackURL: final_data.data.attributes.playbackUrl, title: 'Final project' }],
    });

    //Loop through all files and download them

    console.log("Title: " + title);
    let count = 0;
    for (let i = 0; i < allVideos.length; i++) {
        const unit = allVideos[i];
        for (let a = 0; a < unit.videoData.length; a++) {
            const vData = unit.videoData[a];

            if (!fs.existsSync(`domestika_courses/${title}/${unit.title}/`)) {
                fs.mkdirSync(`domestika_courses/${title}/${unit.title}/`, { recursive: true });
            }

            const unitNumber = unit.title.slice(0, 2).replace("U","S");
            const filename = unitNumber + "E" + (a+1) + "-" + unit.title.slice(3).trim().replace(/[/\\?%*:|"<>]/g, '-').replaceAll(" ", "_") + "-" + vData.title.trim().replace(/[/\\?%*:|"<>]/g, '-').replaceAll(" ", "_");
            console.log(filename);
            console.log("domestika_courses/" + title + "/" + filename + ".mp4");
            if (!fs.existsSync("domestika_courses/" + title + "/" + filename + ".mp4")) {
                let log = await exec(`./N_m3u8DL-RE -sv res="1080*":codec=hvc1:for=best "${vData.playbackURL}" --save-dir "domestika_courses/${title}" --save-name "${filename}"`);
                let log2 = await exec(`./N_m3u8DL-RE --auto-subtitle-fix --sub-format SRT --select-subtitle lang="${subtitle_lang}":for=all "${vData.playbackURL}" --save-dir "domestika_courses/${title}" --save-name "${filename}"`);
            } else {
                console.log("Already downloaded");
            }
            if (!fs.existsSync("domestika_courses/" + title + "/" + filename + ".remux.mp4")) {
                if (fs.existsSync("domestika_courses/" + title + "/" + filename + ".mp4") && fs.existsSync("domestika_courses/" + title + "/" + filename + ".en.srt")) {
                    let log3 = exec(`ffmpeg -i "domestika_courses/${title}/${filename}.mp4" -i "domestika_courses/${title}/${filename}.en.srt" -c copy -c:s mov_text "domestika_courses/${title}/${filename}.remux.mp4"`);
                } else if (fs.existsSync("domestika_courses/" + title + "/" + filename + ".mp4")) {
                    await exec(`cp "domestika_courses/${title}/${filename}.mp4" "domestika_courses/${title}/${filename}.remux.mp4"`);
                }
            }


            if (debug) {
                debug_data.push({
                    videoURL: vData.playbackURL,
                    output: [log, log2],
                });
            }

            count++;
            console.log(`Download ${count}/${totalVideos} Downloaded`);
        }

    }

    await browser.close();

    if (fs.existsSync("fl.txt")){
        await exec(`rm "fl.txt"`);
    }

    if (!fs.existsSync("domestika_courses/" + title + ".mp4")){
        console.log("Concat videos")
        await exec(`find "domestika_courses/${title}" -name "*.remux.mp4" | sort | sed 's:\ :\\\ :g'| sed 's/^/file /' > fl.txt;`);
        let log4 = await exec(`ffmpeg -f concat -safe 0 -i fl.txt -c copy -scodec copy "domestika_courses/${title}.mp4"`);
        await exec(`rm "fl.txt"`);
        console.log(log4);
    }

    if (debug) {
        fs.writeFileSync('log.json', JSON.stringify(debug_data));
        console.log('Log File Saved');
    }


    console.log('All Videos Downloaded');
}

async function getInitialProps(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setCookie(...cookies);
    await page.goto(url);

    const data = await page.evaluate(() => window.__INITIAL_PROPS__);

    let videoData = [];

    if (data && data != undefined) {
        for (let i = 0; i < data.videos.length; i++) {
            const el = data.videos[i];

            videoData.push({
                playbackURL: el.video.playbackURL,
                title: el.video.title,
            });
        }
    }

    await browser.close();

    return videoData;
}

async function fetchFromApi(apiURL, accept_version, access_token) {
    const response = await fetch(apiURL, {
        method: 'get',
        headers: {
            'Content-Type': 'application/vnd.api+json',
            Accept: 'application/vnd.api+json',
            'x-dmstk-accept-version': accept_version,
            authorization: `Bearer ${access_token}`,
        },
    });
    const data = await response.json();

    return data;
}
