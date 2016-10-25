/*const Bluebird = require('bluebird');
const fs = require('fs');
const filePath = process.argv.length > 2 ? process.argv[2] : null;


function readFile(filename) {
  return new Bluebird((resolve, reject) => {
    fs.readFile(filename, 'utf8', function (err, data) {
      if (err) {
        return reject(err);
      }
      return resolve(data);
    });
  });
}*/

function removeAddressFromLine(line) {
  var re = new RegExp("0x[0-9a-fA-F]+(\\s|\\n)", 'm');
  if(re.test(line)){
    return line.replace(re, '');
  }
  return line;
}

function removeLineNumberFromLine(line) {
  var re = new RegExp(":[0-9a-fA-F]+$", "m");
  if(re.test(line)){
    return line.replace(re, '');
  }
  return line;
}

function extractMethodNameFromLine(line) {
  var re = new RegExp("(in )([^ ]+)" , "im");
  return re.exec(line)[2];
}

function extractPathFromLine(line) {
  var re = new RegExp('( (at|from) )([^ |\n]+)' , 'im');
  return re.exec(line)[3];
}

function sanitizeLine(line) {
  line = removeAddressFromLine(line);
  line = removeLineNumberFromLine(line);

  return {
    method: extractMethodNameFromLine(line),
    path: extractPathFromLine(line)
  };

}

module.exports = {
  removeAddressFromLine,
  removeLineNumberFromLine,
  extractPathFromLine,
  extractMethodNameFromLine,
  sanitizeLine
};

/*readFile("./tests/samples/multiline2.txt")
  .then((res) => {
    console.time('Some_Name_Here');
    console.log(sanitizeLine(res));
    console.timeEnd('Some_Name_Here');
  });*/
