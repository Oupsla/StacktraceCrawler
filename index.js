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
      
      return Bluebird.map(promises, (stacktrace) => Bluebird.props(stacktrace));
    });
}

function openStackTracesFromBucket(bucket) {
  return readDir(`${bucketListPath}/${bucket}`)
    .then((bucketSubs) => {
      let promisesStacktraceRead = bucketSubs.map((sub) => readFile(`${bucketListPath}/${bucket}/${sub}/Stacktrace.txt`));

      return Bluebird.all(promisesStacktraceRead);
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

function getScoreByStackTrace(stacktraceAloneParsed, stacktraceSorted) {
  // let stacktraceAloneParsed = parser.splitStackToLines(stacktraceAlone);
  let stacktraceSortedParsed = parser.splitStackToLines(stacktraceSorted);

  return stacktraceAloneParsed.reduce((resultByStacktraceAlone, stacktraceAloneLine) => {
    return stacktraceSortedParsed.reduce((resultBySingleStacktrace, stacktraceSortedLine) => {
      let score = getScoreByLine(stacktraceAloneLine, stacktraceSortedLine);
      return resultBySingleStacktrace + (Array.isArray(score) ? score[0][0] : 0);
    }, resultByStacktraceAlone);
  }, 0);
  // getScoreByLine(parser.sanitizeLine(stacktraceAloneLine), );
}

function getScoreByLine(lineParsed, stacktraceSortedLine) { //comparaison between 2 lines
  let score = 0;

  let fuzz = fuzzy([lineParsed]);

  return fuzz.get(stacktraceSortedLine);



  if (stacktraceSortedLine.search(lineParsed.method) !== -1 && stacktraceSortedLine.search(lineParsed.path) !== -1) {
    score += 4;
  } else if (stacktraceSortedLine.search(lineParsed.path) !== -1) {
    score += 2;
  } else if (stacktraceSortedLine.search(lineParsed.method) !== -1) {
    score++;
  }

  return score;
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
      console.log('restant : ', --i);
      return Object.assign({}, result, { [bucketId]: getScore(stacktraceAloneParsed, bucketsList[bucketId]) })
    }, {})
}

function compareAllBucket(bucketsStacktraces) {
  return getSingleStacktraces()
    .then((stacktraces) => {
      let i = stacktraces.length;
      console.log('stacktraces alone : ', i);

      return stacktraces.reduce((response, stacktrace) => {
        console.log('stacktraces alone restantes : ', --i);
        return Object.assign({}, { [stacktrace.id]: compare(parser.splitStackToLines(stacktrace.content), bucketsStacktraces) }, response);
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
      // return (resultByBucket[key] > max ? resultByBucket[key] : max);
    }, 0);

  return maxKey;
}

function print(results) {
  Object.keys(results)
    .forEach((stacktrace) => console.log(`${stacktrace.split('.txt')[0]} -> ${results[stacktrace]}`))
}

function main() {
  if (!filePath) {
    console.log('You must indicate a file path');
    return 1;
  }

  getExistingBucketsList()
    .then((bucketList) => getAllStacktrace(bucketList)) //Object like {'myBucket': ['myStacktrace']}
    // .then((bucketList) => openStackTracesFromBucket(bucketList[0]))
    .then((bucketList) => compareAllBucket(bucketList))
    // .then((stackTraces) => compare(parser.splitStackToLines(fs.readFileSync('./nautilus/nautilus-testing/10.txt')), stackTraces))
    .then((results) => results.map((result) => getResult(result)))
    .then((results) => print(results))
    .catch((err) => console.error(err));
  
}

return main();

