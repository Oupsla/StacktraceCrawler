const Bluebird = require('bluebird');
const fs = require('fs');
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

function openStackTracesFromBucket(bucket) {
  return readDir(`${bucketListPath}/${bucket}`)
    .then((bucketSubs) => {
      let promisesStacktraceRead = bucketSubs.map((sub) => readFile(`${bucketListPath}/${bucket}/${sub}/Stacktrace.txt`));

      return Bluebird.all(promisesStacktraceRead);
    });
}

function getScore(stacktraceAlone, stacktracesSorted) {
  let scoreList = stacktracesSorted
    .map((singleStacktrace) => getScoreByStackTrace(stacktraceAlone, singleStacktrace));

  if (!scoreList.length) {
    return 0;
  }

  return scoreList.reduce((total, score) => total + score, 0) / scoreList.length; //Average
}

function getScoreByStackTrace(stacktraceAlone, stacktraceSorted) {
  let stacktraceAloneParsed = parser.splitStackToLines(stacktraceAlone);
  let stacktraceSortedParsed = parser.splitStackToLines(stacktraceSorted);

  return stacktraceAloneParsed.reduce((resultByStacktraceAlone, stacktraceAloneLine) => {
    return stacktraceSortedParsed.reduce((resultBySingleStacktrace, stacktraceSortedLine) => {
      return resultBySingleStacktrace + getScoreByLine(stacktraceAloneLine, stacktraceSortedLine);
    }, resultByStacktraceAlone);
  }, 0);
  // getScoreByLine(parser.sanitizeLine(stacktraceAloneLine), );
}

function getScoreByLine(lineParsed, stacktraceSortedLine) { //comparaison between 2 lines
  let score = 0;

  let fuzz = fuzzy([lineParsed]);

  return fuzz.get(stackTraceSortedLine);



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

function compare(bucket, bucketsList) {
  return Object.keys(bucketsList)
    .reduce((result, bucketId) => {
      return Object.assign({}, result, { [bucketId]: getScore(bucket, bucketsList[bucketId]) })
    }, {})
}

function main() {
  if (!filePath) {
    console.log('You must indicate a file path');
    return 1;
  }

  getExistingBucketsList()
    .then((bucketList) => getAllStacktrace(bucketList)) //Object like {'myBucket': ['myStacktrace']}
    // .then((bucketList) => openStackTracesFromBucket(bucketList[0]))
    .then((stackTraces) => console.log(compare(fs.readFileSync('./nautilus/nautilus-testing/10.txt'), stackTraces)))
    .catch((err) => console.error(err));
  
}

return main();

