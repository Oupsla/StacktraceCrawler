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

    it('removes line number from multiline', function(done) {
      var result = parser.removeLineNumberFromLine(multiline);
      assert.equal(result.substring(152,177), 'at /usr/include/stdlib.h\n');
      done();
    });

    it('removes line number from multiline2', function(done) {
      var result = parser.removeLineNumberFromLine(multiline2);
      assert.equal(result.substring(109,140), 'at nautilus-icon-canvas-item.c\n');
      done();
    });

    it('removes line number from bad line', function(done) {
      var result = parser.removeLineNumberFromLine('test');
      assert.equal(result, 'test');
      done();
    });
  });

  describe('extract frame from line' , function () {

    it('extract frame from multiline', function(done) {
      var result = parser.extractFrameFromLine(multiline);
      assert.equal(result, '1');
      done();
    });

    it('extract frame from multiline2', function(done) {
      var result = parser.extractFrameFromLine(multiline2);
      assert.equal(result, '0');
      done();
    });

    it('extract frame from bad multiline', function(done) {
      var result = parser.extractFrameFromLine('test');
      assert.equal(result, '');
      done();
    });

  });

  describe('extract method from line' , function () {

    it('extract method from multiline', function(done) {
      var result = parser.extractMethodNameFromLine('#1 in thumbnail_read_callback (source_object=<value optimized out>, res=<value optimized out>,');
      assert.equal(result, 'thumbnail_read_callback');
      done();
    });

    it('extract method from multiline', function(done) {
      var result = parser.extractMethodNameFromLine('#4  in gdk_display_manager_open_display () from /usr/lib/x86_64-linux-gnu/libgdk-3.so.0\nNo symbol table info available.');
      assert.equal(result, 'gdk_display_manager_open_display');
      done();
    });

    it('extract method from multiline', function(done) {
      var result = parser.extractMethodNameFromLine('test');
      assert.equal(result, '');
      done();
    });


  });

  describe('extract path from line' , function () {

    it('extract path from multiline', function(done) {
      var result = parser.extractPathFromLine(multiline);
      assert.equal(result, '/usr/include/stdlib.h:291');
      done();
    });

    it('extract path from multiline2', function(done) {
      var result = parser.extractPathFromLine(multiline2);
      assert.equal(result, 'nautilus-icon-canvas-item.c:508');
      done();
    });

    it('extract path from multiline2', function(done) {
      var result = parser.extractPathFromLine('test');
      assert.equal(result, '');
      done();
    });
  });

  describe('split stack to lines' , function () {

    it('split stackline to lines', function(done) {
      var result = parser.splitStackToLines(stacktrace);
      assert.equal(result.length, 9);
      done();
    });

    it('split multiline to lines', function(done) {
      var result = parser.splitStackToLines(multiline);
      assert.equal(result.length, 1);
      done();
    });

    it('split badlines to lines', function(done) {
      var result = parser.splitStackToLines('');
      assert.equal(result.length, 0);
      done();
    });

  });

  describe('extract sha1 from lines' , function () {

    it('get sh1 from multiline', function(done) {
      var result = parser.getSHA1(multiline);
      assert.equal(result, 'a3f7c4d652ea5a13e70cfe0e24497839155aa6e4');
      done();
    });
  });

  describe('sanitize lines' , function () {

    it('sanitize line from multine', function(done) {
      var result = parser.sanitizeLine(multiline);
      assert.equal(result.address, '0x000000000049ccf1');
      assert.equal(result.method, 'thumbnail_read_callback');
      assert.equal(result.path, '/usr/include/stdlib.h');
      assert.equal(result.frame, '1');
      done();
    });

    it('sanitize line from multine', function(done) {
      var result = parser.sanitizeLine(multiline2);
      assert.equal(result.address, '0x0819fc26');
      assert.equal(result.method, 'nautilus_icon_canvas_item_get_image');
      assert.equal(result.path, 'nautilus-icon-canvas-item.c');
      assert.equal(result.frame, '0');
      done();
    });
  });

  describe('split And Sanitize Stack' , function () {

    it('split and sanitize stackline to lines', function(done) {
      var result = parser.splitAndSanitizeStack(stacktrace);
      assert.equal(result.length, 7);
      assert.equal(result[0].method, 'g_hash_table_foreach_remove_or_steal');
      done();
    });

  });





});
