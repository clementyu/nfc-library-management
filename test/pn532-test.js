var pn532 = require('pn532');
var { SerialPort } = require('serialport');

const port = new SerialPort({
  path: '/dev/tty.usbserial-210',
  baudRate: 115200,
});

var rfid = new pn532.PN532(port);

console.log('Waiting for rfid ready event...');
rfid.on('ready', function() {
    console.log('Listening for a tag scan...');
    rfid.on('tag', function(tag) {
        console.log(Date.now(), 'UID:', tag.uid);
    });
});