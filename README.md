# Node JS Tool to download full courses from Domestika

**This is a fork of https://github.com/ReneR97/domestika-downloader**

This tool is a batch downloader for Domestika courses. 
It downloads all courses defined in the input.txt and uses a file structure that is compatible with Plex TV Show library.
Every course is handled as a 'Show' and every unit is a new 'Season'. This tool also downloads the course thumbnail and a thumbnail for every lesson.

![screen.png](images%2Fscreen.png)

![screen2.png](images%2Fscreen2.png)

![plex1.png](images%2Fplex1.png)

![plex2.png](images%2Fplex2.png)

![plex3.png](images%2Fplex3.png)

> **Warning**
> You need to own the course you want to download. So you either have to have bought it or got it for "free" with your premium account.

## How to Use

### Requirements
- Domestika account
- The application was tested on MacOS, it "should" work on Linux too
- NodeJS
- N_m3u8DL-RE https://github.com/nilaoda/N_m3u8DL-RE/releases
- ffmpeg

### Required third party applications

Before you can start it, you have to download N_m3u8DL-RE from here: https://github.com/nilaoda/N_m3u8DL-RE/releases. Get the lasted version binary and place it in the folder. Make sure it's named correctly ("N_m3u8DL-RE.exe" or "N_m3u8DL-RE").

Also be sure you have ffmpeg installed.

### Get your Domestika credentials

To get the _domestika_session and the \_credentials_ you will need to install a Chrome extension called Cookie-Editor.

After you installed the extension, log into domestika and open the extension.

In the window popup, look for "\_domestika_session", click to open it and copy the contents of the Value field into the value field under cookies.

then look for the "_credentials_" cookie, copy the value of that into the "_credentials_" variable.

### Running the application
After you have done that, just open a terminal and type

```bash
npm i
```

After that to start the script type

```bash
node server.js
```
Access the WebUI at http://localhost:3000

Fill your Domestika credentials and add the course URLs line by line. The course_url is just the full URL of the course you want to download. For example:
https://www.domestika.org/en/courses/3086-creating-animated-stories-with-after-effects/course
Press Submit and wait for all the videos to download.
All the courses will be downloaded in a folder called "domestika_courses/{coursename}/".

> Your Domestika credentials (session cookies) are not stored or forwarded to any parties other than domestika.org. 
> The login method can be considered as session hijacking. You may encounter more captcha verification popups on your next logins on domestika.org after using the downloader as the tools used for the downloader are recognized as possible bots.


### Packaging
```bash
pkg --targets node14-linux-x64,node14-macos-x64 .
```

## Configuring a Plex library for Domestika Downloader

- Create a new TV Show Library
- Set the domestika_courses folder as a source
- In the Advanced tab set the Agent to "Personal Media Shows" and set Seasons to "Hide"

## Planned features
- Proper download queue (pause, stop, resume download)
- Better handling of failed/cancelled/already downloaded videos
- Prepackaged app release
- Running in docker

