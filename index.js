const Bluebird = require('bluebird');
const fs = require('fs');
const _ = require('lodash');
const fuzzy = require('fuzzyset.js');
const parser = require('./utils/parse');
const filePath = process.argv.length > 2 ? process.argv[2] : 'nautilus';
const bucketListPath = './nautilus/nautilus-training';
const pathSingleTrace = './nautilus/nautilus-testing';
const mathjs = require('mathjs');

// coefficient for the distance to the top frame
let coeffC = 15;
let coeffO = 10;
let coeffD = 5;

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

  return scoreList.reduce((total, score) => total + score, 0) / scoreList.length; //Average
}

function getScoreByStackTrace(stacktraceAloneParsed, stacktraceSortedParsed) { //[{method, path}]

  if (parser.getSHA1(stacktraceAloneParsed) === parser.getSHA1(stacktraceSortedParsed)) {
    return Number.MAX_SAFE_INTEGER;
  }

  let minimumNumberFrame = Math.min(stacktraceAloneParsed.length,  stacktraceSortedParsed.length);
  let matrix = getSimilarityMatrix(stacktraceAloneParsed, stacktraceSortedParsed);
  let sumMinimum = getSum(minimumNumberFrame);


  let similarity = mathjs.dotDivide(matrix[matrix.length - 1][matrix[0].length - 1], sumMinimum);
  return similarity;
}

function getSimilarityMatrix(stacktraceAloneParsed, stacktraceSortedParsed) {
  let matrix = [];

  for(let i = 0; i < stacktraceAloneParsed.length ; i++) {
    let lineOfMatrix = [];

    for(let j = 0; j < stacktraceSortedParsed.length ; j++) {

      if(i === 0 && j === 0) {
        if(stacktraceAloneParsed[i].method === stacktraceSortedParsed[j].method &&
          stacktraceAloneParsed[i].path === stacktraceSortedParsed[j].path){
          lineOfMatrix.push(5);
        }
        else if(stacktraceAloneParsed[i].path === stacktraceSortedParsed[j].path){
          lineOfMatrix.push(1);
        }
        else if(stacktraceAloneParsed[i].method === stacktraceSortedParsed[j].method){
          lineOfMatrix.push(1);
        }
        else {
          lineOfMatrix.push(0);
        }
      } else {
        let result1, result2, result3;

        if(i !== 0 && j !== 0)
          result1 = matrix[i-1][j-1] + getCost(i, j);
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

    //matrix.push(lineOfMatrix);
  }
  return matrix;
  //console.log(matrix);
}

function getSum(minimumNumberFrame) {
  let sumReturned = 0;
  for (let i = 0; i <= minimumNumberFrame; i++) {
    sumReturned += Math.exp(-(coeffC * i));
  }
  return sumReturned;
}

function getCost(i, j) {
  if(i !== j){
    return 0;
  }
  return Math.exp((-coeffC) * Math.min(i,j)) * Math.exp((-coeffO) * Math.abs(i-j));
}

function getScoreByLine(lineParsed, stacktraceSortedLine) { //comparaison between 2 lines
  let score = 0;

  if (!lineParsed.method || !lineParsed.path) {
    if (stacktraceSortedLine.address != null && lineParsed.address != null && stacktraceSortedLine.address === lineParsed.address) {
      return 100;
    }
    return 0;
  }

  if (!stacktraceSortedLine.method || !stacktraceSortedLine.path) {
    if (stacktraceSortedLine.address != null && lineParsed.address != null && stacktraceSortedLine.address === lineParsed.address) {
      return 100;
    }
    return 0;
  }

  const scoreSameAdress = 1000;
  const scoreSameMethodAndPath = 500;
  const scoreSamePath = 20;
  const scoreSameMethod = 10;

  if (stacktraceSortedLine.method === lineParsed.method && stacktraceSortedLine.path === lineParsed.path &&
      (stacktraceSortedLine.address != null && lineParsed.address != null && stacktraceSortedLine.address === lineParsed.address)) {
    score += scoreSameAdress;
    //score += (getFrameRate(lineParsed.frame, lineParsed.totalFrame) * scoreSameAdress);
    //score += (getOffsetRate(lineParsed.frame, stacktraceSortedLine.frame, lineParsed.totalFrame, stacktraceSortedLine.totalFrame) * scoreSameAdress);
  } else if (stacktraceSortedLine.method === lineParsed.method && stacktraceSortedLine.path === lineParsed.path) {
    score += scoreSameMethodAndPath;
    //score += (getFrameRate(lineParsed.frame, lineParsed.totalFrame) * scoreSameMethodAndPath);
    //score += (getOffsetRate(lineParsed.frame, stacktraceSortedLine.frame, lineParsed.totalFrame, stacktraceSortedLine.totalFrame) * scoreSameMethodAndPath);
  } else if (stacktraceSortedLine.path === lineParsed.path) {
    score += scoreSamePath;
    //score += (getOffsetRate(lineParsed.frame, lineParsed.totalFrame) * scoreSamePath);
    //score += (getOffsetRate(lineParsed.frame, stacktraceSortedLine.frame, lineParsed.totalFrame, stacktraceSortedLine.totalFrame) * scoreSamePath);
  } else if (stacktraceSortedLine.method === lineParsed.method) {
    score += scoreSameMethod;
    //score += (getFrameRate(lineParsed.frame, lineParsed.totalFrame) * scoreSameMethod);
    //score += (getOffsetRate(lineParsed.frame, stacktraceSortedLine.frame, lineParsed.totalFrame, stacktraceSortedLine.totalFrame) * scoreSameMethod);
  }

  return score;
}

function getFrameRate(frameToCompare, totalFrame) {
  return (1 - (frameToCompare/totalFrame));
}

function getOffsetRate(frameToCompare, currentFrame, totalFrameToCompare, totalCurrentFrame) {
  if (frameToCompare === currentFrame) {
    return 1;
  }

  return 1 - (Math.abs(frameToCompare - currentFrame) / Math.max(totalFrameToCompare, totalCurrentFrame));
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
  return writeFile("result.txt", result);
}

function main() {
  if (!filePath) {
    console.log('You must indicate a file path');
    return 1;
  }
  console.time('Start');

  getExistingBucketsList()
    .then((bucketList) => getAllStacktrace(bucketList)) //Object like {'myBucket': ['myStacktrace']}
    .then((bucketList) => compareAllBucket(bucketList))
    .then((results) => Object.keys(results).reduce((obj, key) => Object.assign({}, {[key]: getResultByBucket(results[key])}, obj), {}))
    .then((results) => print(results))
    .then(() => console.timeEnd('Start'))
    .catch((err) => console.error(err));


}

return main();
