const Bluebird = require('bluebird');
const fs = require('fs');
const _ = require('lodash');
const fuzzy = require('fuzzyset.js');
const mathjs = require('mathjs');
const fscore = require('fscore');
const parser = require('./utils/parse');

/*const filePath = process.argv.length > 2 ? process.argv[2] : 'nautilus';
const bucketListPath = './nautilus/nautilus-training';
const pathSingleTrace = './nautilus/nautilus-testing';*/

const filePath = process.argv.length > 2 ? process.argv[2] : 'dataset2';
const bucketListPath = './dataset2/training';
const pathSingleTrace = './dataset2/testing';


// coefficient for the distance to the top frame
let coeffC = 2;
let coeffO = 1;
let coeffD = 0.5;

let coeffSame = 2;
let coeffMethod = 0.7;
let coeffPath = 0.1;

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

function getExistingBucketsList() {
  return readDir(bucketListPath);
}


function getSingleStacktraces() {
  return readDir(pathSingleTrace)
    .then((stacktraces) => {
      let promises = stacktraces.reduce((res, stacktrace) => ([...res, { id: stacktrace, content: readFile(`${pathSingleTrace}/${stacktrace}`) }]), []);

      return Bluebird.map(promises, (stacktrace) => {
        return Bluebird.props(stacktrace)
          .then((stacktraceObj) => {
            return { id: stacktraceObj.id, parsedLines: parser.splitAndSanitizeStack(stacktraceObj.content) };
          });
        });
    });
}

function getScore(stacktraceAloneParsed, stacktracesSorted) {
  let scoreList = stacktracesSorted
    .map((singleStacktrace) => getScoreByStackTrace(stacktraceAloneParsed, singleStacktrace));

  if (!scoreList.length) {
    return 0;
  }

  let score = mathjs.max(scoreList); // Max
  //let score = scoreList.reduce((total, score) => total + score, 0) / scoreList.length; // Average

  return score;
}

function getScoreByStackTrace(stacktraceAloneParsed, stacktraceSortedParsed) { //[{method, path}]

  if (parser.getSHA1(stacktraceAloneParsed) === parser.getSHA1(stacktraceSortedParsed)) {
    return Number.MAX_SAFE_INTEGER;
  }

  let minimumNumberFrame = Math.min(stacktraceAloneParsed.length,  stacktraceSortedParsed.length);
  let matrix = getSimilarityMatrix(stacktraceAloneParsed, stacktraceSortedParsed, coeffC, coeffO);
  let sumMinimum = getSum(minimumNumberFrame, coeffC);
  let similarity = mathjs.dotDivide(matrix[matrix.length - 1][matrix[0].length - 1], sumMinimum);

  return similarity;
}

function getSimilarityMatrix(stacktraceAloneParsed, stacktraceSortedParsed, c, o) {
  let matrix = [];

  for(let i = 0; i < stacktraceAloneParsed.length ; i++) {
    let lineOfMatrix = [];

    for(let j = 0; j < stacktraceSortedParsed.length ; j++) {
      if(i === 0 && j === 0) {
        lineOfMatrix.push(getSimilarity(stacktraceAloneParsed, stacktraceSortedParsed, i, j));
      } else {
        let result1, result2, result3;

        if(i !== 0 && j !== 0)
          result1 = matrix[i-1][j-1]
            + getCost(i, j, c, o, stacktraceAloneParsed.length, stacktraceSortedParsed.length)
            + (getSimilarity(stacktraceAloneParsed, stacktraceSortedParsed, i, j) / (i + j));
        else
          result1 = 0;

        if(i !== 0)
          result2 = matrix[i-1][j];
        else
          result2 = 0;

        if(j !== 0)
          result3 = matrix[i][j-1];
        else
          result3 = 0;

        lineOfMatrix.push(mathjs.max(result1, result2, result3));
      }
      matrix[i] = lineOfMatrix;
    }
  }
  return matrix;
}

function getSimilarity(stacktraceAloneParsed, stacktraceSortedParsed, i, j){
  if(stacktraceAloneParsed[i].method === "??" || stacktraceSortedParsed[j].method === "??"){
    if(stacktraceAloneParsed[i].path === stacktraceSortedParsed[j].path)
      return coeffPath;
    else
      return Number.MIN_SAFE_INTEGER;
  }

  if(stacktraceAloneParsed[i].method === stacktraceSortedParsed[j].method &&
    stacktraceAloneParsed[i].path === stacktraceSortedParsed[j].path){
    return coeffSame;
  }
  else if(stacktraceAloneParsed[i].method === stacktraceSortedParsed[j].method){
    return coeffMethod;
  }
  else if(stacktraceAloneParsed[i].path === stacktraceSortedParsed[j].path){
    return coeffPath;
  }
  else {
    return -100;
  }
}

function getSum(minimumNumberFrame, c) {
  let sumReturned = 0;
  for (let i = 0; i <= minimumNumberFrame; i++) {
    sumReturned += Math.exp(-(c * i));
  }
  return sumReturned;
}

function getCost(i, j, c, o, ith, jth) {
  if(ith !== jth){
    return 0;
  }
  return Math.exp((-c) * Math.min(i,j)) * Math.exp((-o) * Math.abs(i-j));
}

function determineOptimalParameters(stacktraces) {
  console.time('determineOptimalParameters');
  console.log('Start of determineOptimalParameters');

  let c = 0;
  let o = 0;
  let d = 0;

  let cPlus = 0.1;
  let oPlus = 0.1;
  let dPlus = 0.01;

  let cmax = 2;
  let omax = 2;
  let dmax = 1;

  let bestC = c;
  let bestO = o;
  let bestD = d;
  let bestFMeasure = 0;

  while(c < cMax){
    while(o < oMax){
      o = 0;

      /* Compute similarity */
      stacktraces.forEach(function (p1) {
        stacktraces.forEach(function (p2) {
          let minimumNumberFrame = Math.min(stacktraceAloneParsed.length,  stacktraceSortedParsed.length);
          let matrix = getSimilarityMatrix(stacktraceAloneParsed, stacktraceSortedParsed, c, o);
          let sumMinimum = getSum(minimumNumberFrame);
          let similarity = mathjs.dotDivide(matrix[matrix.length - 1][matrix[0].length - 1], sumMinimum);

        });
      });
      d = 0;

      while(d < dmax){
        // Compute F-measure
        let fMeasure = fscore(p);

        if(fMeasure > bestFMeasure){
          bestFMeasure = fMeasure;
          bestC = c;
          bestO = o;
          bestD = d;
        }

        d += dPlus;
      }
      o += oPlus;
    }
    c += cPlus;
  }

  coeffC = bestC;
  coeffD = bestD;
  coeffO = bestO;

  console.time('determineOptimalParameters');
  console.log("End of determineOptimalParameters");
}

function openStackTracesFromBucket(bucket) {
  return readDir(`${bucketListPath}/${bucket}`)
    .then((bucketSubs) => {
      let promisesStacktraceRead = bucketSubs.map((sub) => {
        return readFile(`${bucketListPath}/${bucket}/${sub}/Stacktrace.txt`)
          .then((stacktraceContent) => {
              return parser.splitAndSanitizeStack(stacktraceContent);
          });
      });
      return Bluebird.all(promisesStacktraceRead);
    });
}

function getAllStacktrace(bucketList) {
  let promisesAllBuckets = bucketList.reduce((globalObj, bucket) => {
    return Object.assign({}, { [bucket]: openStackTracesFromBucket(bucket) }, globalObj);
  }, {});

  return Bluebird.props(promisesAllBuckets);
}


function compare(stacktraceAloneParsed, bucketsList) {
  let i = Object.keys(bucketsList).length;
  return Object.keys(bucketsList)
    .reduce((result, bucketId) => {
      //console.log('restant : ', --i);
      return Object.assign({}, result, { [bucketId]: getScore(stacktraceAloneParsed, bucketsList[bucketId]) })
    }, {})
}

function compareAllBucket(bucketsStacktraces) {
  return getSingleStacktraces()
    .then((stacktraces) => {
      let i = stacktraces.length;


      return stacktraces.reduce((response, stacktrace) => {
        //console.log('stacktraces alone restantes : ', --i);
        return Object.assign({}, { [stacktrace.id]: compare(stacktrace.parsedLines, bucketsStacktraces) }, response);
      }, {})
    });
}

function getResultByBucket(resultByBucket) {
  let max = 0;
  let maxKey = Object.keys(resultByBucket)
    .reduce((index, key) => {
      if (resultByBucket[key] > max) {
        max = resultByBucket[key];
        return key;
      } else {
        return index;
      }
    }, 0);

  return maxKey;
}

function print(results) {
  result = "";
  Object.keys(results)
    .forEach((stacktrace) => result += `${stacktrace.split('.txt')[0]} -> ${results[stacktrace]}\n`)

  let dateNow = new Date();
  return writeFile("result"+ dateNow.toISOString() +".txt", result);
}

function main() {
  if (!filePath) {
    console.log('You must indicate a file path');
    return 1;
  }
  console.time('Start');
  console.log('Parameters : ')
  console.log("coeffC : " + coeffC);
  console.log("coeffO : " + coeffO);
  //console.log("coeffD : " + coeffD);

  console.log("coeffSame : " + coeffSame);
  console.log("coeffMethod : " + coeffMethod);
  console.log("coeffPath : " + coeffPath);


  getExistingBucketsList()
    .then((bucketList) => getAllStacktrace(bucketList)) //Object like {'myBucket': ['myStacktrace']}
    .then((bucketList) => compareAllBucket(bucketList))
    .then((results) => Object.keys(results).reduce((obj, key) => Object.assign({}, {[key]: getResultByBucket(results[key])}, obj), {}))
    .then((results) => print(results))
    .then(() => console.timeEnd('Start'))
    .catch((err) => console.error(err));


}

return main();
