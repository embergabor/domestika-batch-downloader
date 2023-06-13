const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');
const fsPromises = require('fs').promises;
const fetch = require("node-fetch");
const {all} = require("express/lib/application");

const debug = false;
const debug_data = [];

let courseCoverURL = "";

const subtitle_lang = 'en';

//Cookie used to retrieve video information
let cookies = "";
let access_token = "";

function domestikadl(sessionCookie, credentialsCookie, courseUrls) {
    /*const originalConsoleLog = console.log;
    console.log = (...args) => {
        clientSocket.send(args.join(' '));
        originalConsoleLog.apply(console, args);
    };

    const originalConsoleError = console.error;
    console.error = (...args) => {
        clientSocket.send(args.join(' '));
        originalConsoleError.apply(console, args);
    };*/

    console.log("sessionCookie " + sessionCookie);
    console.log("credentialsCookie " + credentialsCookie);
    console.log("courseUrls " + courseUrls);

    if (!fs.existsSync('N_m3u8DL-RE') && !fs.existsSync('N_m3u8DL-RE.exe')) {
        throw Error('N_m3u8DL-RE not found! Download the Binary here: https://github.com/nilaoda/N_m3u8DL-RE/releases')
    }

    setAuth(sessionCookie, credentialsCookie);

    downloadCourses(courseUrls);
}

function setAuth(sessionCookie, credentialsCookie) {
    //Cookie used to retrieve video information
    cookies = [
        {
            name: '_domestika_session',
            value: sessionCookie,
            domain: 'www.domestika.org',
        }
    ];

    //Get access token from the credentials
    let at = decodeURI(credentialsCookie);
    let regex_token = /accessToken\":\"(.*?)\"/gm;
    access_token = regex_token.exec(at)[1];
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

async function downloadCourses(courseUrls) {

    let allCourses =  [];

    for(let course of courseUrls) {
        let courseData
        if(course.trim().length > 0) {
            try {
                if (!course.endsWith("/course")) {
                    course += "/course";
                }
                console.log(course);
                courseData = await scrapeSite(course);

            } catch (error) {
                console.error('An error occurred:', error.message);
                if (error.message.includes("Unexpected end of JSON")) {
                    console.log("Your Domestika credentials are not valid! Please log in and copy your credentials to index.js");
                    process.exit();
                }
                break;
            }
        }
        allCourses.push(courseData);
    }

    // Convert the array to JSON
    const jsonArray = JSON.stringify(allCourses, null, 2);

    // Save the JSON array to a file
    fs.writeFileSync('courses.json', jsonArray);

    console.log("courses.json created");

}

async function scrapeSite(courseUrl) {
    //Scrape site for links to videos
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setCookie(...cookies);
    await page.goto(courseUrl);
    const html = await page.content();
    const $ = cheerio.load(html);

    let allVideos = [];

    let units = $('h4.h2.unit-item__title a');

    let title = $('h1.course-header-new__title')
        .text()
        .trim()
        .replace(/[/\\?!%*:\'\’|"<>]/g, '').replaceAll(" ", "-");

    console.log("Title: " + title);

    //Get all the links to the m3u8 files
    for (let i = 0; i < units.length; i++) {
        let videoData = await getVideoData( $(units[i]).attr('href'));
        allVideos.push({
            title: $(units[i])
                .text()
                .trim()
                .replace(/[/\\?!%*:|"<>]/g, '').replaceAll(" ", "-"),
            videoData: videoData,
        });
    }

    let regex_final = /courses\/(.*?)-/gm;
    let final_project_id = regex_final.exec($(units[units.length - 1]).attr('href'))[1];
    let final_data = await fetchFromApi(`https://api.domestika.org/api/courses/${final_project_id}/final-project?with_server_timing=true`, 'finalProject.v1', access_token);
    final_project_id = final_data.data.relationships.video.data.id;
    final_data = await fetchFromApi(`https://api.domestika.org/api/videos/${final_project_id}?with_server_timing=true`, 'video.v1', access_token);

    if (final_data.data.attributes.playbackUrl && final_data.data.attributes.playbackUrl !== undefined) {
        allVideos.push({
            title: 'U9-Final_project',
            videoData: [{
                status: "added",
                playbackURL: final_data.data.attributes.playbackUrl,
                title: 'Final project',
                chapterThumb: final_data.data.attributes.cover.original.url
            }],
        });
    }

    const courseData = {
        status: added,
        downloadedState: "0",
        courseUrl: courseUrl,
        courseTitle: title,
        courseCoverURL: courseCoverURL,
        allVideos: allVideos
    }

    //fs.writeFileSync('objects.json', courseData);

    //store course data in queue

    //downloadCourse(courseData);

    return courseData;

    
}

async function downloadCourse(courseData) {

    let count = 0;
    const allVideos = courseData.allVideos;
    const title = courseData.courseTitle;

    downloadImage(courseData.courseCoverURL, "domestika_courses/" + title, "poster.jpg")

    for (let i = 0; i < allVideos.length; i++) {
        const unit = allVideos[i];

        for (let a = 0; a < unit.videoData.length; a++) {
            const vData = unit.videoData[a];

            if (!fs.existsSync(`domestika_courses/${title}/${unit.title}/`)) {
                fs.mkdirSync(`domestika_courses/${title}/${unit.title}/`, { recursive: true });
            }


            const unitNumber = unit.title === "Final-project" ? "S9" : unit.title.slice(0, 2).replace("U","S");
            const filename = unitNumber + "E" + (a+1) + "-" + vData.title.trim().replace(/[/\\?!%*':|"<>]/g, '').replaceAll(" ", "-");
            console.log("domestika_courses/" + title + "/" + unit.title + "/" + filename + ".mp4");

            if (!fs.existsSync("domestika_courses/" + title + "/" + unit.title + "/" + filename + ".mp4")) {
                let log = await exec(`./N_m3u8DL-RE -sv res="1080*":codec=hvc1:for=best "${vData.playbackURL}" --save-dir "domestika_courses/${title}/${unit.title}" --save-name "${filename}" --auto-subtitle-fix --sub-format SRT --select-subtitle lang="${subtitle_lang}" -M format=mp4`);
                await exec(`ffmpeg -i "domestika_courses/${title}/${unit.title}/${filename}.mp4" -metadata title="${vData.title}" -c copy -scodec copy temp.mp4 && mv temp.mp4 "domestika_courses/${title}/${unit.title}/${filename}.mp4"`);
                if (debug) {
                    debug_data.push({
                        videoURL: vData.playbackURL,
                        output: [log],
                    });
                }
            } else {
                console.log("Already downloaded");
            }

            const thumbnailURL = vData.chapterThumb;
            console.log("thumbnailurl: " + thumbnailURL);
            downloadImage(thumbnailURL, "domestika_courses/" + title + "/" + unit.title, filename + ".jpg")



            count++;
            console.log(`Download ${count}/${allVideos.length} Downloaded`);
        }

    }

    if (debug) {
        fs.writeFileSync('log.json', JSON.stringify(debug_data));
        console.log('Log File Saved');
    }

    console.log('All Videos Downloaded for Course: ' + title);
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

async function getVideoData(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setCookie(...cookies);
    await page.goto(url);

    const data = await page.evaluate(() => window.__INITIAL_PROPS__);

    let videoData = [];

    if (data && data !== undefined) {
        if(data.videos && data.videos !== undefined) {
            for (let i = 0; i < data.videos.length; i++) {
                const el = data.videos[i];
                videoData.push({
                    status: "added",
                    playbackURL: el.video.playbackURL,
                    title: el.video.title,
                    chapterThumb: el.video.cover
                });
            }
            if(courseCoverURL === "") {
                console.log("data course cover: " + data.course.cover);
                courseCoverURL = data.course.cover;
            }
        } else if (data.video && data.video !== undefined) {
            // trailer

            /*const el = data.video;
            videoData.push({
                playbackURL: el.playbackURL,
                title: "Trailer",
                chapterThumb: el.cover
            });*/
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
    return await response.json();
}

module.exports = domestikadl;
