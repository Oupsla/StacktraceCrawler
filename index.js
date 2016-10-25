const Bluebird = require('bluebird');
const fs = require('fs');
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
    .map((singleStacktrace) => {
      return ((stacktraceAlone.length / singleStacktrace.toString().length) * 100);
    });

  if (!scoreList.length) {
    return 0;
  }

  return scoreList.reduce((total, score) => total + score, 0) / scoreList.length; //Average
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

