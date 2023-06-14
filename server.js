const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const https = require("https");
const util = require("util");
const exec = util.promisify(require('child_process').exec);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from the "public" directory
app.use(express.static('public'));

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: false }));

// Parse JSON bodies (as sent by API clients)
app.use(express.json());

// WebSocket connection
let clientSocket = null;

// WebSocket event handlers
let connectedClients = new Set();

wss.on('connection', (ws) => {
    connectedClients.add(ws);

    ws.on('message', (message) => {
        console.log('Received message from client:', message);
    });

    ws.on('close', () => {
        connectedClients.delete(ws);
    });
});

function broadcastData(data) {
    connectedClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

function broadcastMessage(message) {
    connectedClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

const originalConsoleError = console.error;
console.error = (...args) => {
    broadcastMessage("status: " + args.join(' '));
    originalConsoleError.apply(console, args);
};

function readFileAndSendData() {
    const data = fs.readFileSync('courses.json', 'utf8');
    if (data) {
        const jsonData = JSON.parse(data);
        const message = JSON.stringify(jsonData);

        connectedClients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

}

// Call the method initially
readFileAndSendData();

// Schedule the method to run every 5 seconds
setInterval(readFileAndSendData, 5000);

// Define a route to handle form submission
app.post('/submit', (req, res) => {

    const arg1 = req.body.arg1;
    const arg2 = req.body.arg2;
    const arg3 = req.body.arg3;
    const arg4 = req.body.arg4;
    const textareaValue = req.body.textarea.split('\n');

    console.log(`Received arguments: arg1=${arg1}, arg2=${arg2}, textarea=${textareaValue}`);

    // Send an acknowledge response
    res.send(`Received arguments: arg1=${arg1}, arg2=${arg2}, textarea=${textareaValue}`);

    addCourses(arg1, arg2, textareaValue, arg3, arg4);
});

app.post('/startMethod', (req, res) => {
    // Perform any desired action or call the specific method on the server
    console.log('Start Method button clicked!');
    // You can add your server-side code here to perform the desired action

    downloadCourses();

});

// Start the server
server.listen(3000, () => {
    console.log('Server listening on port 3000');
});

function refreshQueue(courseData) {
    const courseDataArray = readQueue();

    const index = courseDataArray.findIndex((item) => item.courseUrl === courseData.courseUrl);

    if (index !== -1) {
        courseDataArray[index] = courseData;
        writeQueue(courseDataArray);
    }
}

function readQueue() {
    const data = fs.readFileSync('courses.json', 'utf8');
    if(data) {
        return JSON.parse(data);
    } else {
        return {};
    }


}

function writeQueue(courseDataArray) {
    fs.writeFileSync('courses.json', JSON.stringify(courseDataArray, null, 2));
}

function clearQueue() {
    fs.writeFileSync('courses.json', "");
}

function addCourses(sessionCookie, credentialsCookie, courseUrls, quality, subtitleLang) {
    if (!fs.existsSync('N_m3u8DL-RE') && !fs.existsSync('N_m3u8DL-RE.exe')) {
        throw Error('N_m3u8DL-RE not found! Download the Binary here: https://github.com/nilaoda/N_m3u8DL-RE/releases')
    }
    addCoursesToQueue(sessionCookie, credentialsCookie, courseUrls, quality, subtitleLang);
    //downloadCourses();
}

async function addCoursesToQueue(sessionCookie, credentialsCookie, courseUrls, quality, subtitleLang) {
    //Cookie used to retrieve video information
    const cookies = [
        {
            name: '_domestika_session',
            value: sessionCookie,
            domain: 'www.domestika.org',
        }
    ];

    //Get access token from the credentials
    let at = decodeURI(credentialsCookie);
    let regex_token = /accessToken\":\"(.*?)\"/gm;
    const access_token = regex_token.exec(at)[1];

    let newCourses =  [];

    const existingCourses = readQueue();

    let filteredArray = [];

    if(Object.keys(existingCourses).length !== 0) {
        filteredArray = courseUrls.filter(function(element) {
            return !existingCourses.some(function(item) {
                return item.courseUrl === element;
            });
        });
    } else {
        filteredArray = courseUrls;
    }

    for(let courseUrl of filteredArray) {
        if(courseUrl.trim().length > 0) {
            try {
                if (!courseUrl.endsWith("/course")) {
                    courseUrl += "/course";
                }
                console.log(courseUrl);
                const courseData = await scrapeSite(cookies, access_token, courseUrl);
                courseData.quality = quality;
                courseData.subtitle = subtitleLang;
                newCourses.push(courseData);

            } catch (error) {
                console.error('An error occurred:', error.message);
                if (error.message.includes("Unexpected end of JSON")) {
                    console.log("Your Domestika credentials are not valid! Please log in and copy your credentials to index.js");
                    broadcastMessage("Your Domestika credentials are not valid! Please log in and copy your credentials to index.js");
                    process.exit();
                }
                break;
            }
        }
    }

    if(Object.keys(existingCourses).length !== 0) {
        newCourses.forEach((element) => {
            existingCourses.push(element);
        });
        writeQueue(existingCourses);
    } else {
        writeQueue(newCourses);
    }

    console.log("courses.json created");
    broadcastMessage("status: All courses added to download queue. You can start downloading.")
}

async function scrapeSite(cookies, access_token, courseUrl) {

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
    broadcastMessage("status: Scraping data for " + title)
    let totalVideos = 1;

    //Get all the links to the m3u8 files
    for (let i = 0; i < units.length; i++) {
        let videoData = await getVideoData(cookies, $(units[i]).attr('href'));
        allVideos.push({
            title: $(units[i])
                .text()
                .trim()
                .replace(/[/\\?!%*:|"<>]/g, '').replaceAll(" ", "-"),
            videoData: videoData,
        });

        totalVideos += videoData.length;
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
        totalVideos: totalVideos,
        courseUrl: courseUrl,
        courseTitle: title,
        courseCoverURL: allVideos[0].videoData.courseCoverURL,
        allVideos: allVideos
    }

    //fs.writeFileSync('objects.json', courseData);

    //store course data in queue

    //downloadCourse(courseData);

    return courseData;
}

async function getVideoData(cookies, url) {

    broadcastMessage("status: Scraping data for " + url)
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
                    chapterThumb: el.video.cover,
                    courseCoverURL: data.course.cover
                });
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

async function downloadCourses(){
    const courseDataArray = readQueue();

    for (let i = 0; i < courseDataArray.length; i++) {
        await downloadCourse(courseDataArray[i]);
    }
}

async function downloadCourse(courseData) {

    let count = 0;
    const units = courseData.allVideos;
    const title = courseData.courseTitle;

    if (!fs.existsSync(`domestika_courses/${title}/`)) {
        fs.mkdirSync(`domestika_courses/${title}/`, {recursive: true});
    }

    await downloadImage(courseData.courseCoverURL, "domestika_courses/" + title, "poster.jpg")

    for (let i = 0; i < units.length; i++) {
        const unit = units[i];

        for (let a = 0; a < unit.videoData.length; a++) {
            const vData = unit.videoData[a];
            const unitNumber = unit.title === "Final-project" ? "S9" : unit.title.slice(0, 2).replace("U", "S");
            const filename = unitNumber + "E" + (a + 1) + "-" + vData.title.trim().replace(/[/\\?!%*':|"<>]/g, '').replaceAll(" ", "-");
            console.log("domestika_courses/" + title + "/" + unit.title + "/" + filename + ".mp4");

            broadcastMessage("status: Downloading " + title + " " + unit.title + " " + filename);

            if(vData.status !== "Done") {

                if (!fs.existsSync(`domestika_courses/${title}/${unit.title}/`)) {
                    fs.mkdirSync(`domestika_courses/${title}/${unit.title}/`, {recursive: true});
                }



                console.log("playbackURL: " + vData.playbackURL);

                const thumbnailURL = vData.chapterThumb;
                console.log("thumbnailurl: " + thumbnailURL);

                // Download thumbnail
                await downloadImage(thumbnailURL, "domestika_courses/" + title + "/" + unit.title, filename + ".jpg")

                // Download video and mux subtitle
                if (!fs.existsSync("domestika_courses/" + title + "/" + unit.title + "/" + filename + ".mp4")) {
                    await exec(`./N_m3u8DL-RE -sv res="${courseData.quality}*":codec=hvc1:for=best "${vData.playbackURL}" --save-dir "domestika_courses/${title}/${unit.title}" --save-name "${filename}" --auto-subtitle-fix --sub-format SRT --select-subtitle lang="${courseData.subtitle}" -M format=mp4 > download.log`);
                } else {
                    console.log("Already downloaded");
                }
                // Remux video and add title metadata
                await exec(`ffmpeg -y -i "domestika_courses/${title}/${unit.title}/${filename}.mp4" -metadata title="${vData.title}" -c copy -scodec copy temp.mp4 && mv temp.mp4 "domestika_courses/${title}/${unit.title}/${filename}.mp4"`);

                courseData.allVideos[i].videoData[a].status = "Done";
                refreshQueue(courseData);
            } else {
                console.log("Already downloaded status");
            }

            count++;
            console.log(`Download ${count}/${courseData.totalVideos} Downloaded`);
            broadcastMessage(`status: Download ${count}/${courseData.totalVideos} Downloaded`)
        }

    }

    console.log('All Videos Downloaded for Course: ' + title);
}

async function downloadImage(imageUrl, destinationPath, filename) {
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
