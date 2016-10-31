const Bluebird = require('bluebird');
const fs = require('fs');
const _ = require('lodash');
const fuzzy = require('fuzzyset.js');
const parser = require('./utils/parse');
const filePath = process.argv.length > 2 ? process.argv[2] : 'nautilus';
const bucketListPath = './nautilus/nautilus-training';

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
  return readDir('./nautilus/nautilus-testing')
    .then((stacktraces) => {
      let promises = stacktraces.reduce((res, stacktrace) => ([...res, { id: stacktrace, content: readFile(`./nautilus/nautilus-testing/${stacktrace}`) }]), []);

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
  return stacktraceAloneParsed.reduce((resultByStacktraceAlone, stacktraceAloneLine) => {
    return stacktraceSortedParsed.reduce((resultBySingleStacktrace, stacktraceSortedLine) => {
      let score = getScoreByLine(stacktraceAloneLine, stacktraceSortedLine);
      return resultBySingleStacktrace + score;
    }, resultByStacktraceAlone);
  }, 0);
}

function getScoreByLine(lineParsed, stacktraceSortedLine) { //comparaison between 2 lines
  let score = 0;

  //let fuzz = fuzzy([lineParsed]);

  //return fuzz.get(stacktraceSortedLine);

  if(lineParsed.method === "??" || !lineParsed.method || !lineParsed.path)
    return 0;

  if(stacktraceSortedLine.method === "??" || !stacktraceSortedLine.method || !stacktraceSortedLine.path)
    return 0;

  if (stacktraceSortedLine.method === lineParsed.method && stacktraceSortedLine.path === lineParsed.path &&
      (stacktraceSortedLine.address != null && lineParsed.address != null && stacktraceSortedLine.address === lineParsed.address)) {
    score += 300;
  } else if (stacktraceSortedLine.method === lineParsed.method && stacktraceSortedLine.path === lineParsed.path) {
    score += 100;
  } else if (stacktraceSortedLine.path === lineParsed.path) {
    score += 5;
  } else if (stacktraceSortedLine.method === lineParsed.method) {
    score += 1;
  }

  return score;
}

function openStackTracesFromBucket(bucket) {
  return readDir(`${bucketListPath}/${bucket}`)
    .then((bucketSubs) => {
      let promisesStacktraceRead = bucketSubs.map((sub) => {
        //console.log("sub : ", sub);
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
  //console.log("Compare all buckets");
  //console.log(bucketsStacktraces);
  return getSingleStacktraces()
    .then((stacktraces) => {
      let i = stacktraces.length;
      //console.log('stacktraces alone : ', i);

      return stacktraces.reduce((response, stacktrace) => {
        //console.log('stacktraces alone restantes : ', --i);
        return Object.assign({}, { [stacktrace.id]: compare(stacktrace.parsedLines, bucketsStacktraces) }, response);
      }, {})
    });
}

function getResultByBucket(resultByBucket) {
  //console.log(resultByBucket);
  let max = 0;
  let maxKey = Object.keys(resultByBucket)
    .reduce((index, key) => {
      if (resultByBucket[key] > max) {
        max = resultByBucket[key];
        return key;
      } else {
        return index;
      }
      // return (resultByBucket[key] > max ? resultByBucket[key] : max);
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
    // .then((bucketList) => openStackTracesFromBucket(bucketList[0]))
    .then((bucketList) => compareAllBucket(bucketList))
    // .then((stackTraces) => compare(parser.splitStackToLines(fs.readFileSync('./nautilus/nautilus-testing/10.txt')), stackTraces))
    .then((results) => Object.keys(results).reduce((obj, key) => Object.assign({}, {[key]: getResultByBucket(results[key])}, obj), {}))
    .then((results) => print(results))
    .then(() => console.timeEnd('Start'))
    .catch((err) => console.error(err));


}

return main();
