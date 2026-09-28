/**
 * One plain-English sentence for the most common errors a student hits.
 * The real Python message is always shown too; this is the "what does that
 * mean" line under it.
 */
const RULES = [
  // Syntax and indentation
  ['SyntaxError', /was never closed/, 'A bracket was opened but never closed. Find the ( [ or { and add its partner.'],
  ['SyntaxError', /unmatched|does not match opening/, 'There’s a closing bracket with no opening one to match it.'],
  ['SyntaxError', /expected ':'/, 'Lines that start with if, elif, else, for, while, def or class need a colon (:) at the end.'],
  ['SyntaxError', /unterminated string|EOL while scanning/, 'A quote was opened but never closed. Strings need a matching " or \' at the end.'],
  ['SyntaxError', /unterminated triple-quoted/, 'A """ string was started but never finished.'],
  ['SyntaxError', /invalid character.*(“|”|‘|’)/, 'That line has curly “smart quotes” pasted from a document. Retype them as plain " or \'.'],
  ['SyntaxError', /invalid character/, 'That line has a character Python can’t read — often something pasted from a document.'],
  ['SyntaxError', /Maybe you meant '==' or ':='/, 'Use == to compare two things. A single = puts a value into a variable.'],
  ['SyntaxError', /cannot assign to/, 'The left side of = has to be a variable name.'],
  ['SyntaxError', /Perhaps you forgot a comma/, 'Looks like a comma is missing between two items.'],
  ['SyntaxError', /'return' outside function/, 'return only works inside a def.'],
  ['SyntaxError', /'break' outside loop|'continue' not properly in loop/, 'break and continue only work inside a for or while loop.'],
  ['SyntaxError', /expected 'except' or 'finally'/, 'A try: block needs an except: (or finally:) after it.'],
  ['SyntaxError', /./, 'Python couldn’t read this line. Look for a missing bracket, quote, colon or comma — sometimes the real mistake is on the line above.'],
  ['IndentationError', /expected an indented block/, 'The line after a colon (:) must be indented. Put the cursor at its start and press Tab.'],
  ['IndentationError', /unexpected indent/, 'This line is indented but shouldn’t be. Line it up with the code around it.'],
  ['IndentationError', /unindent does not match/, 'This line’s indent doesn’t line up with any line above. Make it match exactly.'],
  ['TabError', /./, 'This file mixes tabs and spaces for indenting. Re-indent the lines with Tab so they match.'],

  // Names
  ['NameError', /Did you mean/, 'Looks like a typo — Python suggests a name that does exist.'],
  ['NameError', /name '(pygame|random|math|time|sys|os|json)' is not defined/, 'Add an import line at the top of the file, like: import $1'],
  ['NameError', /name '(\w+)' is not defined/, 'Python doesn’t know “$1”. Check the spelling and capital letters, and make sure it’s created (with =, def or import) before this line runs.'],
  ['UnboundLocalError', /./, 'A function changes a variable that was made outside it. Add a “global name” line at the top of the function, or pass the value in.'],

  // Types and values
  ['TypeError', /can only concatenate str \(not "(\w+)"\) to str/, 'You’re joining text and a number with +. Turn the number into text with str(...) or use an f-string: f"Score: {score}".'],
  ['TypeError', /unsupported operand type\(s\) for .*'str' and 'int'|'int' and 'str'/, 'Text and numbers can’t be mixed in math. Use int(...) to turn typed text into a number.'],
  ['TypeError', /'(\w+)' object is not callable/, 'There are () after something that isn’t a function. Maybe a variable has the same name as a function.'],
  ['TypeError', /missing (\d+) required positional argument/, 'A function was called with fewer values than its def asks for.'],
  ['TypeError', /takes (\d+) positional arguments? but (\d+) (were|was) given/, 'A function got more values than its def has room for. If it’s a method in a class, check that the def starts with self.'],
  ['TypeError', /'NoneType' object/, 'Something is None — often a function that doesn’t return anything was used as if it did.'],
  ['TypeError', /'(\w+)' object is not subscriptable/, 'Square brackets [ ] only work on lists, strings, dicts and tuples.'],
  ['TypeError', /'(\w+)' object is not iterable/, 'A for loop needs a list, string or range to go through.'],
  ['TypeError', /invalid color argument/, 'Colors are three numbers from 0 to 255, like (255, 0, 0), or a name like "red".'],
  ['TypeError', /Argument must be rect style object/, 'A Rect needs x, y, width, height — like pygame.Rect(10, 20, 50, 50).'],
  ['ValueError', /invalid literal for int\(\)/, 'int() can only turn whole-number text like "42" into a number. Check what was typed.'],
  ['ValueError', /could not convert string to float/, 'float() needs text that looks like a number, like "3.5".'],
  ['ValueError', /invalid color/, 'That color isn’t one pygame knows. Try a name like "red" or numbers like (255, 0, 0).'],
  ['ValueError', /too many values to unpack|not enough values to unpack/, 'The number of names on the left of = doesn’t match the number of values on the right.'],
  ['ZeroDivisionError', /./, 'Something was divided by zero. Check the number after / or %.'],
  ['IndexError', /out of range/, 'That position isn’t in the list. The first item is [0] and the last is [len(list) - 1].'],
  ['KeyError', /./, 'That key isn’t in the dictionary. Check the spelling, or use .get(key) to get None instead of an error.'],
  ['AttributeError', /module 'pygame(\.\w+)?' has no attribute/, 'That part of pygame is misspelled, or it isn’t in the Arcade’s version yet (see Help → What works).'],
  ['AttributeError', /'NoneType' object has no attribute/, 'Something is None — often a function that doesn’t return anything was used as if it did.'],
  ['AttributeError', /has no attribute/, 'That object doesn’t have that attribute or method. Check the spelling and capitals.'],
  ['RecursionError', /./, 'A function keeps calling itself without stopping. Make sure there’s a case that returns without calling itself again.'],

  // Files and modules
  ['FileNotFoundError', /./, 'Upload the file under Assets and use its exact name — capitals and the ending (.png, .wav) count.'],
  ['ModuleNotFoundError', /browser|desktop windows|private/, ''],
  ['ModuleNotFoundError', /./, 'That library isn’t available here. You can use Python’s built-in modules, pygame, and your own .py files.'],
  ['ImportError', /cannot import name/, 'That name isn’t in the module. Check the spelling, and whether the other file defines it.'],
  ['error', /video system not initialized|call pygame.display.set_mode/, 'Call pygame.display.set_mode(...) before you draw or read events.'],
  ['EOFError', /./, 'The program asked for input but none came.'],
  ['Crash', /./, 'Python stopped unexpectedly and restarted. Look for code that builds a huge list, or a loop inside a function that never ends.'],
  ['LoadError', /./, 'Python couldn’t download. Check the internet connection and reload the page.'],
];

export function hintFor(error) {
  if (!error) return '';
  const type = error.type || '';
  const msg = error.message || '';
  for (const [t, re, text] of RULES) {
    if (t !== type) continue;
    const m = msg.match(re);
    if (m) return text.replace(/\$(\d)/g, (_, i) => m[Number(i)] || '');
  }
  return '';
}
