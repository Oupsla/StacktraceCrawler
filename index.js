const Bluebird = require('bluebird');
const fs = require('fs');
const filePath = process.argv.length > 2 ? process.argv[2] : null;

function readFile() {
  return new Bluebird((resolve, reject) => {
    fs.readFile(filename, 'utf8', function (err, data) {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    });
  });
}

function writeFile(data) {
  return new Bluebird((resolve, reject) => {
    fs.writeFile(filename, data, (err, resp) => {
      if (err) {
        return reject(err);
      }
      return resolve(resp);
    });
  });
}

if (!filePath) {
  console.log('You must indicate a file path');
  return 1;
}
