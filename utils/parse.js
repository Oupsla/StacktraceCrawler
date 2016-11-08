const crypto = require('crypto');

const immunesFunction = ['??', 'clone' , 'start_thread', '__libc_start_main',
'g_main_loop_run', 'gtk_main_do_event', 'gtk_main', 'g_main_context_dispatch',
'start_thread', 'g_application_run', 'g_main_context_iterate', 'IA__gtk_main',
'IA__g_main_loop_run', 'IA__g_main_context_dispatch', 'gdk_event_dispatch',
'IA__gtk_main_do_event', 'IA__gtk_propagate_event'];

function removeAddressFromLine(line) {
  var re = new RegExp("0x[0-9a-fA-F]+(\\s|\\n)", 'm');
  if(re.test(line)) {
    return { line: line.replace(re, ''), address: re.exec(line)[0].replace(' ', '') };
  }
  return { line, address: null };
}

function removeLineNumberFromLine(line) {
  var re = new RegExp(":[0-9a-fA-F]+$", "m");
  if(re.test(line)){
    return line.replace(re, '');
  }
  return line;
}

function extractFrameFromLine(line) {
  var re = new RegExp("^#([0-9]+)" , "im");
  array = re.exec(line);
  if(array == null || array.length < 2)
    return "";
  return parseInt(array[1], 10);
}

function extractMethodNameFromLine(line) {
  var re = new RegExp("(#[0-9]+ {1,2})(in |)([^ ]+)" , "im");
  var reNumber = new RegExp("[0-9]{2,}" , "im");

  array = re.exec(line);
  if(array == null)
    return "";

  return array[3].replace(reNumber, '');
}

function extractPathFromLine(line) {
  var re = new RegExp('( (at|from) )([^ |\n]+)' , 'im');
  array = re.exec(line);

  if(array == null)
    return "";

  let path = array[3];

  // Remove version of library  
  var re2 = new RegExp('-[\d+.]*[\d+]' , 'g');
  path = path.replace(/-[\d+.]*[\d+]/g, '');
  return array[3];
}

function sanitizeLine(line) {
  let lineObj = removeAddressFromLine(line);
  line = lineObj.line;
  line = removeLineNumberFromLine(line);
  let method = extractMethodNameFromLine(line);
  let path = extractPathFromLine(line);
  let frame = extractFrameFromLine(line);

  return {
    address: lineObj.address,
    method,
    path,
    frame
  };
}

function getSHA1(input) {
  return crypto.createHash('sha1').update(JSON.stringify(input)).digest('hex')
}

function splitStackToLines(stack){
  var lines = [];

  const regex = /#\d+((?!#\d)[\s\S])*/g;
  let m;

  while ((m = regex.exec(stack)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
          regex.lastIndex++;
      }

      m.forEach((match, groupIndex) => {
          if(match !== "\n")
            lines.push(match);
      });
  }

  return lines;
}

function splitAndSanitizeStack(stacktrace){
  let lines = splitStackToLines(stacktrace);
  let results = [];
  let count = 0;

  lines.forEach((line, index) => {
    let sanitizedLine = sanitizeLine(line);
    sanitizedLine.totalFrame = lines.length;

    if (count === 0
      || (count > 0 && sanitizedLine.method !== results[count - 1].method
        && immunesFunction.indexOf(sanitizedLine.method) === -1)) {
      results.push(sanitizedLine);
      count++;
    }
  });

  return results;
}

module.exports = {
  removeAddressFromLine,
  removeLineNumberFromLine,
  extractPathFromLine,
  extractMethodNameFromLine,
  extractFrameFromLine,
  sanitizeLine,
  splitStackToLines,
  splitAndSanitizeStack,
  getSHA1
};
