const Bluebird = require('bluebird');
const fs = require('fs');


const sinon = require('sinon');
const chai = require('chai');
const assert = chai.assert,
    expect = chai.expect;

const parser = require('../utils/parse.js');


var multiline, multiline2, singleline, stacktrace;

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

before(function(done) {
  readFile('test/samples/multiline.txt')
    .then((stacktraceContent) => {
        multiline = stacktraceContent;
        done();
    });
});

before(function(done) {
  readFile('test/samples/multiline2.txt')
    .then((stacktraceContent) => {
        multiline2 = stacktraceContent;
        done();
    });
});

before(function(done) {
  readFile('test/samples/singleline.txt')
    .then((stacktraceContent) => {
        singleline = stacktraceContent;
        done();
    });
});

before(function(done) {
  readFile('test/samples/stacktrace.txt')
    .then((stacktraceContent) => {
        stacktrace = stacktraceContent;
        done();
    });
});


describe('The parser module', function () {

  describe('remove adress' , function () {

    it('removes address from multiline', function(done) {
      var result = parser.removeAddressFromLine(multiline);
      assert.equal(result.address, '0x000000000049ccf1');
      assert.equal(result.line, '#1  in thumbnail_read_callback (source_object=<value optimized out>, res=<value optimized out>,\n    user_data=<value optimized out>) at /usr/include/stdlib.h:291\n\tstate = (ThumbnailState *) 0x1d8e4b0\n\tfile_size = 1828114\n\tfile_contents = 0x1de4480 "ð¯\\202\\001"\n\tresult = <value optimized out>\n\tdirectory = (NautilusDirectory *) 0xda68a0\n\tpixbuf = (GdkPixbuf *) 0x1853680\n\tlocation = <value optimized out>\n');
      done();
    });

    it('removes address from multiline2', function(done) {
      var result = parser.removeAddressFromLine(multiline2);
      assert.equal(result.address, '0x0819fc26');
      assert.equal(result.line.substring(0,6), '#0  in');
      done();
    });

    it('removes address from singleline', function(done) {
      var result = parser.removeAddressFromLine(singleline);
      assert.equal(result.address, '0x00007f182a1ae36a');
      assert.equal(result.line.substring(0,6), '#0  in');
      done();
    });

    it('removes address from bad line', function(done) {
      var result = parser.removeAddressFromLine('test');
      assert.equal(result.address, null);
      assert.equal(result.line, 'test');
      done();
    });

  });

  describe('remove line number' , function () {

    it('removes address from multiline', function(done) {
      var result = parser.removeLineNumberFromLine(multiline);
      assert.equal(result.substring(152,177), 'at /usr/include/stdlib.h\n');
      done();
    });

    it('removes address from multiline2', function(done) {
      var result = parser.removeLineNumberFromLine(multiline2);
      assert.equal(result.substring(109,140), 'at nautilus-icon-canvas-item.c\n');
      done();
    });

    it('removes address from bad line', function(done) {
      var result = parser.removeLineNumberFromLine('test');
      assert.equal(result, 'test');
      done();
    });
  });



});
