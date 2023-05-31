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

const session= 'JCq%2BsBo%2F3s1CRHdif6vEqtACfOqrtbFrPZhhnPmSWlPTbF9dbsi1BT3hy47Bm4IANCYTlnVqOn9H%2B2KlJP4qv%2BRBYYG8paYJTBZipT7qUku7HIXbJFYXmuxkYNdhCEsHQmKhmJHloRxAsu%2BfZ%2BHfakUcvmUjHLxd6IpNZ%2FXA8PBupzhsBhAOghNLL3tZf%2FMCgHuIk1Oe%2BjXuv9UyZJEByivf4eBKTTnls4Tu132gDJav8k3BEVaVTpT2WjRfXDpbnmeZ%2FIfPt6zlXYuwiRu7VZD2vMHSJUQgycYFzpZdufUx4ujIIDovHqlpN9ZCi9UBodhETWwI04NTig7LzJG7dJHyLmtdnyRVnOYwL0gzVzb0O5jFxYbyf17zHAt24sn34LY%2BFkSVEy4caO0zlpi2KFqkgWjwF3D7IkUAmuDdi%2BZbfNJQ0KBacKff2nN6Bp%2Fp8Bbxj0D%2F4SZVY5qS1KTUYsuadG1bgps%2F2CR6yrMKB6PRtLru9mi5029JcILHHiuSxh2C2oVV6yRn%2Fz%2FrGeQ6LS6OBeWqaNnWoqJxLRgr4E%2Bb3%2FuoH9DcAlqMiWtgBriwPRCNs3gConOpHdtvWa16Cd4mwX3bS%2ByY3yDG9yUqhQeNa7SC1EM%3D--zbsnzjFlzSye41yb--X0nYrJGFmZXWIfZUtzkU2A%3D%3D';

//Credentials needed for the access token to get the final project
const _credentials_ = '{%22accessToken%22:%22hYtvKlM7jir8fM5L58_i9320QuQdYckJi67K098OQcE%22%2C%22refreshToken%22:%22lIEL-UhgWOxvjn7f3YcdsWzXWG_pfKyitPCQ1nhyzn8%22%2C%22isEmpty%22:false}';


const subtitle_lang = 'en';

//Cookie used to retreive video information
const cookies = [
    {
        name: '_domestika_session',
        value: session,
        domain: 'www.domestika.org',
    }
];

let courseCoverURL = "";

//Get access token from the credentials
let access_token = decodeURI(_credentials_);
let regex_token = /accessToken\":\"(.*?)\"/gm;
access_token = regex_token.exec(access_token)[1];

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
    for(let course of course_urls) {
        if(course.trim().length > 0) {
            try {
                if (!course.endsWith("/course")) {
                    course += "/course";
                }
                console.log(course);
                await scrapeSite(course);
            } catch (error) {
                console.error('An error occurred:', error.message);
                if (error.message.includes("Unexpected end of JSON")) {
                    console.log("Your Domestika credentials are not valid! Please log in and copy your credentials to index.js");
                    process.exit();
                }
                break;
            }
        }
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
        .replace(/[/\\?!%*:\'\’|"<>]/g, '').replaceAll(" ","-");

    console.log("Title: " + title);
    let totalVideos = 1;

    //Get all the links to the m3u8 files
    for (let i = 0; i < units.length ; i++) {
        let videoData = await getInitialProps($(units[i]).attr('href'));
        allVideos.push({
            title: $(units[i])
                .text()
                .trim()
                .replace(/[/\\?!%*:|"<>]/g, '').replaceAll(" ","-"),
            videoData: videoData,
        });

        totalVideos += videoData.length;
    }

   /* let regex_final = /courses\/(.*?)-/gm;
    let final_project_id = regex_final.exec($(units[units.length - 1]).attr('href'))[1];
    let final_data = await fetchFromApi(`https://api.domestika.org/api/courses/${final_project_id}/final-project?with_server_timing=true`, 'finalProject.v1', access_token);
    final_project_id = final_data.data.relationships.video.data.id;
    final_data = await fetchFromApi(`https://api.domestika.org/api/videos/${final_project_id}?with_server_timing=true`, 'video.v1', access_token);

    allVideos.push({
        title: 'U9-Final_project',
        videoData: [{ playbackURL: final_data.data.attributes.playbackUrl,
            title: 'Final project',
            chapterThumb: final_data.data.attributes.cover.original.url
        }],
    });*/

    //Loop through all files and download them


    let count = 0;
    console.log("courseThumb: " + courseCoverURL);
    downloadImage(courseCoverURL, "domestika_courses/" + title, "poster.jpg")

    for (let i = 0; i < allVideos.length; i++) {
        const unit = allVideos[i];

        for (let a = 0; a < unit.videoData.length; a++) {
            const vData = unit.videoData[a];

            if (!fs.existsSync(`domestika_courses/${title}/${unit.title}/`)) {
                fs.mkdirSync(`domestika_courses/${title}/${unit.title}/`, { recursive: true });
            }


            const unitNumber = unit.title == "Final-project" ? "S9" : unit.title.slice(0, 2).replace("U","S");
            const filename = unitNumber + "E" + (a+1) + "-" + vData.title.trim().replace(/[/\\?!%*':|"<>]/g, '').replaceAll(" ", "-");
            console.log("domestika_courses/" + title + "/" + unit.title + "/" + filename + ".mp4");
            if (!fs.existsSync("domestika_courses/" + title + "/" + unit.title + "/" + filename + ".mp4")) {
                let log = await exec(`./N_m3u8DL-RE -sv res="1080*":codec=hvc1:for=best "${vData.playbackURL}" --save-dir "domestika_courses/${title}/${unit.title}" --save-name "${filename}" --auto-subtitle-fix --sub-format SRT --select-subtitle lang="${subtitle_lang}" -M format=mp4`);
                await exec(`ffmpeg -i "domestika_courses/${title}/${unit.title}/${filename}.mp4" -metadata title="${vData.title}" -c copy -scodec copy temp.mp4 && mv temp.mp4 "domestika_courses/${title}/${unit.title}/${filename}.mp4"`);
            } else {
                console.log("Already downloaded");
            }

            const thumbnailURL = vData.chapterThumb;
            console.log("thumbnailurl: " + thumbnailURL);
            downloadImage(thumbnailURL, "domestika_courses/" + title + "/" + unit.title, filename + ".jpg")

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

    /*if (!fs.existsSync(`domestika_courses/${title}/${title}.mkv`)) {
      const mergelog = await exec(`./merge_chapters.sh domestika_courses/${title}`);
      console.log(mergelog);
    }*/

    if (debug) {
        fs.writeFileSync('log.json', JSON.stringify(debug_data));
        console.log('Log File Saved');
    }

    console.log('All Videos Downloaded');
}

function downloadImage(imageUrl, destinationPath, filename) {
    console.log("" + imageUrl);
    const https = require('https');
    const fs = require('fs');

    const file = fs.createWriteStream(destinationPath + "/" + filename);

    https.get(imageUrl, (response) => {
        response.on('data', (data) => {
            file.write(data);
        });

        response.on('end', () => {
            file.end();
            console.log('Image downloaded successfully.');
        });
    }).on('error', (err) => {
        console.error('Error downloading the image:', err);
    });
}

async function getInitialProps(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setCookie(...cookies);
    await page.goto(url);

    const data = await page.evaluate(() => window.__INITIAL_PROPS__);

    let videoData = [];

    if (data && data != undefined) {
        if(data.videos && data.videos != undefined) {
            for (let i = 0; i < data.videos.length; i++) {
                const el = data.videos[i];
                videoData.push({
                    playbackURL: el.video.playbackURL,
                    title: el.video.title,
                    chapterThumb: el.video.cover
                });

            }
            console.log("data course cover: " + data.course.cover);
            courseCoverURL = data.course.cover;

        } else if (data.video && data.video != undefined) {
            const el = data.video;
            videoData.push({
                playbackURL: el.playbackURL,
                title: "Final project",
                chapterThumb: el.cover
            });
        }
    }

    await browser.close();

    return videoData;
}

async function fetchFromApi(apiURL, accept_version, access_token) {
    console.log(apiURL);
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
