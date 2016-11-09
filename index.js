const Bluebird = require('bluebird');
const mathjs = require('mathjs');
const _ = require('lodash');
const fuzzy = require('fuzzyset.js');
const parser = require('./utils/parse');
const filer = require('./utils/filer');
const filePath = process.argv.length > 2 ? process.argv[2] : 'nautilus';
const bucketListPath = './nautilus/nautilus-training';
const pathSingleTrace = './nautilus/nautilus-testing';

/*const filePath = process.argv.length > 2 ? process.argv[2] : 'dataset2';
const bucketListPath = './dataset2/training';
const pathSingleTrace = './dataset2/testing';*/

// coefficient for the distance to the top frame
let coeffC = 2;
let coeffO = 2;
let coeffD = 0.5;

let coeffSame = 2;
let coeffMethod = 0.7;
let coeffPath = 0.2;


function getExistingBucketsList() {
  return filer.readDir(bucketListPath);
}

function getBiggerBucket() {
  return getExistingBucketsList()
    .then((buckets) => {
      return Bluebird.map(buckets, (bucket) => {
        return Bluebird.props({bucket, stacktraces: filer.readDir(`${bucketListPath}/${bucket}`)});
      });
    })
    .then((results) => {
      return _.maxBy(results, (item) => item.stacktraces.length);
    })
    .catch((err) => console.error(err));
}


function getSingleStacktraces(stacktracesAlone) {
  let promise = stacktracesAlone ? Bluebird.resolve(stacktracesAlone.stacktraces) : filer.readDir(pathSingleTrace);
  return promise
    .then((stacktraces) => {
      let promises = stacktraces.reduce((res, stacktrace) => {
        let fullPath = stacktracesAlone ? `${bucketListPath}/${stacktracesAlone.bucket}/${stacktrace}/Stacktrace.txt` : `${pathSingleTrace}/${stacktrace}`;
        return ([...res, { id: stacktrace, content: filer.readFile(fullPath) }]);
      }, []);

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
        if(stacktraceAloneParsed[i].method === stacktraceSortedParsed[j].method &&
          stacktraceAloneParsed[i].path === stacktraceSortedParsed[j].path){
          lineOfMatrix.push(coeffSame);
        }
        else if(stacktraceAloneParsed[i].method === stacktraceSortedParsed[j].method){
          lineOfMatrix.push(coeffMethod);
        }
        else if(stacktraceAloneParsed[i].path === stacktraceSortedParsed[j].path){
          lineOfMatrix.push(coeffPath);
        }
        else {
          lineOfMatrix.push(0);
        }
      } else {
        let result1, result2, result3;

        if(i !== 0 && j !== 0)
          result1 = matrix[i-1][j-1] + getCost(i, j, c, o, stacktraceAloneParsed.length, stacktraceSortedParsed.length);
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
  return filer.readDir(`${bucketListPath}/${bucket}`)
    .then((stacktraces) => ({ bucket, stacktraces }));
}

function openStackTracesFromBucketAndSanitize(bucket, filter) {
  return filer.readDir(`${bucketListPath}/${bucket}`)
    .then((bucketSubs) => {
      if (filter) {
        bucketSubs = _.difference(bucketSubs, filter);
      }
      let promisesStacktraceRead = bucketSubs.map((sub) => {
        return filer.readFile(`${bucketListPath}/${bucket}/${sub}/Stacktrace.txt`)
          .then((stacktraceContent) => {
              return parser.splitAndSanitizeStack(stacktraceContent);
          });
      });
      return Bluebird.all(promisesStacktraceRead);
    });
}

function getAllStacktrace(bucketList, filter) {
  let promisesAllBuckets = bucketList.reduce((globalObj, bucket) => {
    if (filter && filter.bucket === bucket) {
      return Object.assign({}, { [bucket]: openStackTracesFromBucketAndSanitize(bucket, filter.stacktraces) }, globalObj);
    }
    return Object.assign({}, { [bucket]: openStackTracesFromBucketAndSanitize(bucket) }, globalObj);
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

function compareAllBucket(bucketsStacktraces, singleStracktraces) {
  return getSingleStacktraces(singleStracktraces)
    .then((stacktraces) => {
      // console.log(stacktraces);
      // let i = stacktraces.length;
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
    .forEach((stacktrace) => result += `${stacktrace.split('.txt')[0]} -> ${results[stacktrace]}\n`); //stacktraceAlone -> bucket

  let dateNow = new Date();
  return filer.writeFile("result"+ dateNow.toISOString() +".txt", result);
}

function checkResults(expected, results) {
  let totalFound = Object.keys(results)
    .reduce((total, stacktrace) =>  total + (results[stacktrace] === expected.bucket ? 1 : 0), 0);

  console.log('totalFound -> ', totalFound);
  console.log('expected -> ', expected.stacktraces.length);
  return totalFound / expected.stacktraces.length;
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

// return main();

 //Pour ces stacktraces lesquelles je vais réussir à mettre dedans, à reconnaitre
function findEfficiency(c, o) {
  let bucketMax;
  let stacktracesAlone;
  let expected;
  coeffC = c;
  coeffO = o;

  return getBiggerBucket()//{bucket, stacktraces}
    .then((biggerBucket) => { //On va prendre la moitié de ces stackTraces et les mettre en alone
      stacktracesAlone = biggerBucket.stacktraces.slice(0, biggerBucket.stacktraces.length / 2);
      bucketMax = biggerBucket;
      expected = {bucket: bucketMax.bucket, stacktraces: stacktracesAlone};

      return getExistingBucketsList();
    })
    // .then((bucketList) => Bluebird.reduce(bucketList, (bucket) => openStackTracesFromBucket(bucket)))
    .then((bucketList) => getAllStacktrace(bucketList, expected)) //Object like {'myBucket': ['myStacktrace']}
    .then((bucketList) => compareAllBucket(bucketList, expected))
    .then((results) => Object.keys(results).reduce((obj, key) => Object.assign({}, {[key]: getResultByBucket(results[key])}, obj), {}))
    .then((results) => checkResults(expected, results))
    // .then((results) => console.log(results))
    // .then((results) => print(results))
    // .then(() => console.timeEnd('Start'))
    .catch((err) => console.error(err));
}

function determineBetterCoeff() {
  let promises = [];
  let combi = [];
  const cMax = 2;
  const oMax = 2;
  let maxEfficiency = 0;
  let betterC = 0;
  let betterO = 0;
  let c = 0;
  let o = 0;

  while(c <= cMax) {
    o = 0;
    while(o <= oMax) {
      combi.push({o, c});
      o += 0.1;
    }

    c += 0.1;
  }

  Bluebird.mapSeries(combi, (coeff) => {
    console.log('suivant');

    return findEfficiency(coeff.c, coeff.o)
      .then((efficiency) => {
        if (efficiency > maxEfficiency) {
          betterC = c;
          betterO = o;
          maxEfficiency = efficiency;
        }
        console.log('efficiency : ', efficiency);
        console.log('coeffC : ', coeffC);
        console.log('coeffO : ', coeffO);
      });
  })
  .finally(() => {
    console.log('maxEfficiency : ', maxEfficiency);
    console.log('betterC : ', betterC);
    console.log('betterO : ', betterO);
  });

  // Bluebird.reduce(promises)
  //   .finally(() => {
  //     console.log('maxEfficiency : ', maxEfficiency);
  //     console.log('betterC : ', betterC);
  //     console.log('betterO : ', betterO);
  //   });

  
}

determineBetterCoeff();
