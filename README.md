# Node JS Tool to download full courses from Domestika

**This is a fork of https://github.com/ReneR97/domestika-downloader**

This tool is a batch downloader for Domestika courses. 
It downloads all courses defined in the input.txt and uses a file structure that is compatible with Plex TV Show library.
Every course is handled as a 'Show' and every unit is a new 'Season'. This tool also downloads the course thumbnail and a thumbnail for every lesson.

![plex1.png](images%2Fplex1.png)

![plex2.png](images%2Fplex2.png)

![plex3.png](images%2Fplex3.png)

> **Warning**
> You need to own the course you want to download. So you either have to have bought it or got it for "free" with your premium account.

## Requirements
- Domestika account
- N_m3u8DL-RE https://github.com/nilaoda/N_m3u8DL-RE/releases
- ffmpeg

## Installation

Once you downloaded the Project, open the "index.js" file.

You will find the following variables:

```bash
  const subtitle_lang = 'en';
  const session = '';
  const _credentials_ = "";
```

The course_url is just the full URL of the course you want to download. For example:

https://www.domestika.org/en/courses/3086-creating-animated-stories-with-after-effects/course

To get the _domestika_session and the \_credentials_ you will need to install a Chrome extension called Cookie-Editor.

After you installed the extension, log into domestika and open the extension.

In the window popup, look for "\_domestika_session", click to open it and copy the contents of the Value field into the value field under cookies.

then look for the "_credentials_" cookie, copy the value of that into the "_credentials_" variable.

If you want to change the subtitles that will be downloaded, just put the preferred language into the "subtitle_lang" variable. But make sure the language is available first.

Before you can start it, you have to download N_m3u8DL-RE from here: https://github.com/nilaoda/N_m3u8DL-RE/releases. Get the lasted version binary and place it in the folder. Make sure it's named correctly ("N_m3u8DL-RE.exe").

Also be sure you have ffmpeg installed.

After you have done that, just open a terminal and type

```bash
npm i
```

After that to start the script type

```bash
npm run start.
```

All the courses will be downloaded in a folder called "domestika_courses/{coursename}/".
