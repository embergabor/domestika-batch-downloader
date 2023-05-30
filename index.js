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

const session= 'G0HrTgoI7J%2Buyhy%2FWNjRrph3u9JXJXJMZgAUow4Jwiq6E25%2BLbosWOxVBEa3EGOOalU8R7SEPa8bkHdljh6fO0TV%2FCMk36y0lA7Zlo8LJt468XLADfUZUjRTSX%2FZkH6LA%2BITQ4%2BAQENMJeQ4gk7%2BycovlQ0dAf6VYjxdvaVukyjzJkCTz491%2BKwYwH3CY2OxRa5H0hd3muwwHR0sE9sxTh38sUSKLE4UaXEhy7pDLlj06Lyt6h4m8iDbEdNq5MWnkUI5MsWpgWZeJSjxR%2FVmQpRhlvWeCvTcOd1cuVn1dJtxa9G1WjYevQ3Gc8TFIWnoGQppdrlVBggVT4fsPXAKhKRJTNY3Bv0ER88bcWbufz5pomQCe7xLRr7K%2B8BK0t190AZX1B5Lln4Gjlfhj6J8bCg9MHdUQoZXlY5tfnPIBQElFLK25pojn2AkxlmHABbCxem5EltNlIdXVIZLV9RuJWCtY%2BFByg4tchh2saCdJ8%2FmJ9kn6SoUySa5J9VA0o5Sl1ivRfGDTYI%2FzRkYDRS7gnoT2opPJh5isCh5jqzQT4pG3DvfGH%2FZePCVyhCNdn8c0X0X8Z3JaZ6TRew3TjP8cQYzitJgpXw0Pbu06lYFZLn%2B%2FBYz3cehJyKkyN%2F2ndjMZPHiDqVYaxaEx9jpHFsuvfsRPETtB8qVobdooux2Bi%2Fmdkjd4yGEZxHeYaKiCtcdD5Gr1HWOZIiNS1Jxxmn85r0U--ZkjQO1qeD%2F8mNWDZ--uyJBEIRByNgQ%2FbUtNEO5NA%3D%3D';


//Credentials needed for the access token to get the final project
const _credentials_ = '{%22accessToken%22:%22k-MHHGTAXUPSlIYUEQ-nJ16M63-pKnSpLI6o65L-jAQ%22%2C%22refreshToken%22:%22HaQkEog-ZlUUWXNLU2kvQOp4J-zDfZq0aD5LmLwQw6c%22%2C%22isEmpty%22:false}';


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
        .replace(/[/\\?!%*:'|"<>]/g, '').replaceAll(" ","_");

    let totalVideos = 1;

    //Get all the links to the m3u8 files
    for (let i = 0; i < units.length - 1; i++) {
        let videoData = await getInitialProps($(units[i]).attr('href'));
        allVideos.push({
            title: $(units[i])
                .text()
                .trim()
                .replace(/[/\\?!%*:'|"<>]/g, '').replaceAll(" ","_"),
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
            const filename = unitNumber + "E" + (a+1) + "_" + vData.title.trim().replace(/[/\\?!%*':|"<>]/g, '').replaceAll(" ", "_");
            console.log(filename);
            console.log("domestika_courses/" + title + "/" + unit.title + "/" + filename + ".mp4");
            if (!fs.existsSync("domestika_courses/" + title + "/" + unit.title + "/" + filename + ".mp4")) {
                let log = await exec(`./N_m3u8DL-RE -sv res="1080*":codec=hvc1:for=best "${vData.playbackURL}" --save-dir "domestika_courses/${title}/${unit.title}" --save-name "${filename}" --auto-subtitle-fix --sub-format SRT --select-subtitle lang="${subtitle_lang}" -M format=mp4`);
                //let log2 = await exec(`./N_m3u8DL-RE --auto-subtitle-fix --sub-format SRT --select-subtitle lang="${subtitle_lang}":for=all "${vData.playbackURL}" --save-dir "domestika_courses/${title}" --save-name "${filename}"`);
            } else {
                console.log("Already downloaded");
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
    const mergelog = await exec(`./merge_chapters.sh domestika_courses/${title}`);
    console.log(mergelog);

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
