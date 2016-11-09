const Bluebird = require('bluebird');
const fs = require('fs');

function readFile(filename) {
  return new Bluebird((resolve, reject) => {
    fs.readFile(filename, 'utf8', function (err, data) {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    });
  });
}

function readDir(dirname) {
  return new Bluebird((resolve, reject) => {
    fs.readdir(dirname, function (err, data) {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    });
  });
}

function writeFile(filename, data) {
  return new Bluebird((resolve, reject) => {
    fs.writeFile(filename, data, (err, resp) => {
      if (err) {
        return reject(err);
      }
      return resolve(resp);
    });
  });
}

function getStats(path) {
  return new Bluebird((resolve, reject) => {
    fs.stat(path, function (err, data) {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    });
  });
}

module.exports = {
  readFile,
  readDir,
  writeFile,
  getStats
};