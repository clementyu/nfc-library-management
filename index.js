const express = require('express');
const { WebSocketServer } = require('ws');
const { SerialPort } = require('serialport');
const pn532 = require('pn532');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// --- Argument Parsing ---
const argv = yargs(hideBin(process.argv))
    .option('port', {
        alias: 'p',
        type: 'string',
        describe: 'Serial port for the NFC reader',
        default: '/dev/tty.usbserial-210' // Default port, change if needed
    })
    .option('baudrate', {
        alias: 'b',
        type: 'number',
        describe: 'Baud rate for the serial connection',
        default: 115200
    })
    .help()
    .argv;


const app = express();
const server = app.listen(8080, () => {
    console.log('Web server is listening on port 8080');
});

const wss = new WebSocketServer({ server });

const workDir = path.join(__dirname, 'work');
if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir);
}
const booksDbPath = path.join(workDir, 'books.tsv');
const DB_HEADER = 'UID\tTitle\tAuthor\tPublisher\tStatus\tLastUpdated\n';

// Initialize books.tsv if it doesn't exist
if (!fs.existsSync(booksDbPath)) {
    fs.writeFileSync(booksDbPath, DB_HEADER);
}

// --- Helper function to get a formatted timestamp ---
function getTimestamp() {
    return new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

// --- Helper function to find a book by UID ---
function findBookByUid(uid) {
    const books = fs.readFileSync(booksDbPath, 'utf-8').split('\n');
    const bookLine = books.find(line => line.startsWith(uid));
    if (bookLine) {
        const [uid, title, author, publisher, status, lastUpdated] = bookLine.split('\t');
        return { uid, title, author, publisher, status, lastUpdated };
    }
    return null;
}


// --- Serial Port and NFC Reader Setup ---
console.log(`Connecting to NFC reader on port: ${argv.port} at ${argv.baudrate} baud.`);
const serialPort = new SerialPort({ path: argv.port, baudRate: argv.baudrate });
const rfid = new pn532.PN532(serialPort);

rfid.on('ready', () => {
    console.log('NFC Reader is ready.');
    rfid.on('tag', (tag) => {
        console.log('Tag scanned:', tag.uid);
        const book = findBookByUid(tag.uid);
        const title = book ? book.title : 'Unregistered Book';
        const status = book ? book.status : 'N/A';

        // Broadcast the scanned tag info to all connected clients
        wss.clients.forEach(client => {
            if (client.readyState === client.OPEN) {
                client.send(JSON.stringify({ type: 'tag', uid: tag.uid, title: title, status: status }));
            }
        });
    });
});

serialPort.on('error', (err) => {
    console.error(`Serial Port Error: ${err.message}`);
    console.error('Please ensure the correct --port is specified and the device is connected.');
    process.exit(1);
});


wss.on('connection', ws => {
    console.log('Client connected');
    // Send the current book list to the newly connected client
    sendBookList(ws);

    ws.on('message', message => {
        const data = JSON.parse(message);

        switch (data.command) {
            case 'register':
                registerOrUpdateBook(data.payload);
                break;
            case 'check-out':
                updateBookStatus(data.uid, 'Checked-Out');
                break;
            case 'check-in':
                updateBookStatus(data.uid, 'Available');
                break;
            case 'list-books': // This case is now for manual refresh/initial load
                sendBookList(ws);
                break;
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

function registerOrUpdateBook(book) {
    let books = fs.readFileSync(booksDbPath, 'utf-8').split('\n').filter(line => line.trim() !== '');
    const bookIndex = books.findIndex(line => line.startsWith(book.uid));
    const bookLine = `${book.uid}\t${book.title}\t${book.author}\t${book.publisher}\tAvailable\t${getTimestamp()}`;

    if (bookIndex > 0) { // Update existing book
        books[bookIndex] = bookLine;
    } else { // Register new book
        books.push(bookLine);
    }
    fs.writeFileSync(booksDbPath, books.join('\n') + '\n');
    console.log('Book registered/updated:', book.title);
    broadcastBookList();
}


function updateBookStatus(uid, status) {
    let books = fs.readFileSync(booksDbPath, 'utf-8').split('\n').filter(line => line.trim() !== '');
    const bookIndex = books.findIndex(line => line.startsWith(uid));

    if (bookIndex > 0) { //  > 0 to skip header
        let bookData = books[bookIndex].split('\t');
        bookData[4] = status;
        bookData[5] = getTimestamp(); // Update the timestamp
        books[bookIndex] = bookData.join('\t');
        fs.writeFileSync(booksDbPath, books.join('\n') + '\n');
        console.log(`Book ${uid} status updated to ${status}`);
        broadcastBookList(); // Broadcast the change to all clients
    }
}

// Sends the book list to a single client
function sendBookList(ws) {
    const books = fs.readFileSync(booksDbPath, 'utf-8');
    ws.send(JSON.stringify({ type: 'book-list', data: books }));
}

// Sends the book list to ALL connected clients
function broadcastBookList() {
    const books = fs.readFileSync(booksDbPath, 'utf-8');
    wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
            client.send(JSON.stringify({ type: 'book-list', data: books }));
        }
    });
}

app.use(express.static('web-app'));
