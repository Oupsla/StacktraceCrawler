function removeAddressFromLine(line) {
  var re = new RegExp("0x[0-9a-fA-F]+(\\s|\\n)", 'm');
  if(re.test(line)){
    return line.replace(re, '');
  }
  return line;
}

function removeLineNumberFromLine(line) {
  var re = new RegExp(":[0-9a-fA-F]+$", "m");
  if(re.test(line)){
    return line.replace(re, '');
  }
  return line;
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
  line = removeAddressFromLine(line);
  line = removeLineNumberFromLine(line);

  return {
    method: extractMethodNameFromLine(line),
    path: extractPathFromLine(line)
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

      // The result can be accessed through the `m`-variable.
      m.forEach((match, groupIndex) => {
          if(match != "\n")
            lines.push(match);
      });
  }

  return lines;
}

function splitAndSanitizeStack(stacktrace){

  var lines = splitStackToLines(stacktrace);

  var res = [];
  lines.forEach(function(line) {
      res.push(sanitizeLine(line));
  });

  return res;
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
