const Bluebird = require('bluebird');
const _ = require('lodash');
const mathjs = require('mathjs');
const parser = require('./utils/parse');
const filer = require('./utils/filer');


const bucketListPath = process.argv.length > 2 ? process.argv[2] : './nautilus/nautilus-training';
const pathSingleTrace = process.argv.length > 3 ? process.argv[3] : './nautilus/nautilus-testing';

// const bucketListPath = process.argv.length > 2 ? process.argv[2] : './dataset2/training';
// const pathSingleTrace = process.argv.length > 3 ? process.argv[3] : './dataset2/testing';

// coefficient for the distance to the top frame
let coeffC = 2;
let coeffO = 1;
let coeffD = 0.5;

let coeffSame = 2;
let coeffMethod = 0.7;
let coeffPath = 0.1;

function getExistingBucketsList() {
  return filer.readDir(bucketListPath);
}

function getSingleStacktraces() {
  return filer.readDir(pathSingleTrace)
    .then((stacktraces) => {
      let promises = stacktraces.reduce((res, stacktrace) => ([...res, { id: stacktrace, content: filer.readFile(`${pathSingleTrace}/${stacktrace}`) }]), []);

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

  for (let i = 0; i < stacktraceAloneParsed.length ; i++) {
    let lineOfMatrix = [];

    for (let j = 0; j < stacktraceSortedParsed.length ; j++) {
      if (i === 0 && j === 0) {
        lineOfMatrix.push(getSimilarity(stacktraceAloneParsed, stacktraceSortedParsed, i, j));
      } else {
        let result1, result2, result3;

        if (i !== 0 && j !== 0) {
          result1 = matrix[i-1][j-1] +
            getCost(i, j, c, o, stacktraceAloneParsed.length, stacktraceSortedParsed.length) +
              (getSimilarity(stacktraceAloneParsed, stacktraceSortedParsed, i, j) / (i + j));
        } else {
          result1 = 0;
        }

        if (i !== 0) {
          result2 = matrix[i-1][j];
        } else {
          result2 = 0;
        }

        if (j !== 0) {
          result3 = matrix[i][j-1];
        } else {
          result3 = 0;
        }

        lineOfMatrix.push(mathjs.max(result1, result2, result3));
      }
      matrix[i] = lineOfMatrix;
    }
  }

  return matrix;
}

function getSimilarity(stacktraceAloneParsed, stacktraceSortedParsed, i, j) {
  if (stacktraceAloneParsed[i].method === "??" || stacktraceSortedParsed[j].method === "??") {
    if (stacktraceAloneParsed[i].path === stacktraceSortedParsed[j].path) {
      return coeffPath;
    } else {
      return Number.MIN_SAFE_INTEGER;
    }
  }

  if (stacktraceAloneParsed[i].method === stacktraceSortedParsed[j].method &&
    stacktraceAloneParsed[i].path === stacktraceSortedParsed[j].path) {
    return coeffSame;
  }
  else if (stacktraceAloneParsed[i].method === stacktraceSortedParsed[j].method) {
    return coeffMethod;
  }
  else if (stacktraceAloneParsed[i].path === stacktraceSortedParsed[j].path) {
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
  if (ith !== jth) {
    return 0;
  }

  return Math.exp((-c) * Math.min(i,j)) * Math.exp((-o) * Math.abs(i-j));
}

function openStackTracesFromBucket(bucket) {
  return filer.readDir(`${bucketListPath}/${bucket}`)
    .then((bucketSubs) => {
      let promisesStacktraceRead = bucketSubs.map((sub) => {
        return filer.readFile(`${bucketListPath}/${bucket}/${sub}/Stacktrace.txt`)
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
  return Object.keys(bucketsList)
    .reduce((result, bucketId) => {
      return Object.assign({}, result, { [bucketId]: getScore(stacktraceAloneParsed, bucketsList[bucketId]) });
    }, {});
}

function compareAllBucket(bucketsStacktraces) {
  return getSingleStacktraces()
    .then((stacktraces) => {
      return stacktraces.reduce((response, stacktrace) => {
        return Object.assign({}, { [stacktrace.id]: compare(stacktrace.parsedLines, bucketsStacktraces) }, response);
      }, {});
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
  let result = '';
  Object.keys(results)
    .forEach((stacktrace) => result += `${stacktrace.split('.txt')[0]} -> ${results[stacktrace]}\n`);

  let dateNow = new Date();
  return filer.writeFile('result' + dateNow.toISOString() + '.txt', result);
}

function main() {
  console.time('Start');
  console.log('Parameters : ');
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
