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
  array = re.exec(line);
  if(array == null)
    return "";
  return array[3];
}

function extractPathFromLine(line) {
  var re = new RegExp('( (at|from) )([^ |\n]+)' , 'im');
  array = re.exec(line);

  if(array == null)
    return "";
  return array[3];
}

function sanitizeLine(line) {
  let lineObj = removeAddressFromLine(line);
  line = lineObj.line;
  line = removeLineNumberFromLine(line);
  let method = extractMethodNameFromLine(line);
  let path = extractMethodNameFromLine(line);
  let frame = extractFrameFromLine(line)
  return {
    address: lineObj.address,
    method,
    path,
    frame
  };
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

  return lines.map((line) => {
    let sanitizedLine = sanitizeLine(line);
    sanitizedLine.totalFrame = lines.length;

    return sanitizedLine;
  });
}

module.exports = {
  removeAddressFromLine,
  removeLineNumberFromLine,
  extractPathFromLine,
  extractMethodNameFromLine,
  sanitizeLine,
  splitStackToLines,
  splitAndSanitizeStack
};
