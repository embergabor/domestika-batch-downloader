const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const domestikadl = require('./index.js');

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
wss.on('connection', (ws) => {
    clientSocket = ws;
    console.log('Client connected');
});

// Define a route to handle form submission
app.post('/submit', (req, res) => {

    const arg1 = req.body.arg1;
    const arg2 = req.body.arg2;
    const textareaValue = req.body.textarea.split('\n');

    console.log(`Received arguments: arg1=${arg1}, arg2=${arg2}, textarea=${textareaValue}`);

    // Send an acknowledge response
    res.send(`Received arguments: arg1=${arg1}, arg2=${arg2}, textarea=${textareaValue}`);

    domestikadl(arg1, arg2, textareaValue, clientSocket);
});

// Start the server
server.listen(3000, () => {
    console.log('Server listening on port 3000');
});
