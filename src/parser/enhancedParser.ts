// Line processing modes
export enum LineMode {
  ORIGINAL = 'original', // Keep line as-is
  STRIPPED = 'stripped', // Remove comments, trim whitespace
  COMPACT = 'compact', // Remove comments and all whitespace
}

// Parsed line result
export interface ParsedLine {
  line: string;
  words: Array<[string, number | string]> | string[];
  comments?: string[];
  ln?: number; // Line number (N command)
  cs?: number; // Checksum
  err?: boolean; // Checksum error
  cmds?: string[]; // Special commands (%, $, {)
}

// Parser options
export interface ParserOptions {
  batchSize?: number;
  flatten?: boolean;
  lineMode?: LineMode;
  enableEvents?: boolean;
}

// G-code word parsing regex
const GCODE_WORD_REGEX =
  /(%.*)|({.*)|((?:\$\$)|(?:\$[a-zA-Z0-9#]*))|([a-zA-Z][0-9\+\-\.]+)|(\*[0-9]+)/gim;

// Comment stripping function
function stripComments(line: string): [string, string[]] {
  let result = '';
  let currentComment = '';
  const comments: string[] = [];
  let openParens = 0;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    // Semicolon comment (only outside parentheses)
    if (char === ';' && openParens === 0) {
      comments.push(line.slice(i + 1).trim());
      break;
    }

    // Parentheses comments
    if (char === '(') {
      if (openParens === 0) {
        currentComment = '';
      } else if (openParens > 0) {
        currentComment += char;
      }
      openParens++;
    } else if (char === ')') {
      openParens = Math.max(0, openParens - 1);
      if (openParens === 0) {
        comments.push(currentComment.trim());
        currentComment = '';
      } else if (openParens > 0) {
        currentComment += char;
      }
    } else if (openParens > 0) {
      currentComment += char;
    } else {
      result += char;
    }
  }

  return [result.trim(), comments];
}

// Remove all whitespace
function stripWhitespace(line: string): string {
  return line.replace(/\s+/g, '');
}

// Compute checksum for a line
function computeChecksum(line: string): number {
  let s = line;
  if (s.lastIndexOf('*') >= 0) {
    s = s.substring(0, s.lastIndexOf('*'));
  }

  let cs = 0;
  for (let i = 0; i < s.length; i++) {
    cs ^= s.charCodeAt(i);
  }
  return cs;
}

// Parse a single G-code line
export function parseLine(line: string, options: ParserOptions = {}): ParsedLine {
  const flatten = options.flatten ?? false;
  const lineMode = options.lineMode ?? LineMode.ORIGINAL;

  const result: ParsedLine = {
    line: '',
    words: [],
  };

  let ln: number | undefined;
  let cs: number | undefined;
  const originalLine = line;

  // Strip comments
  const [strippedLine, comments] = stripComments(line);
  const compactLine = stripWhitespace(strippedLine);

  // Set line based on mode
  switch (lineMode) {
    case LineMode.COMPACT:
      result.line = compactLine;
      break;
    case LineMode.STRIPPED:
      result.line = strippedLine;
      break;
    default:
      result.line = originalLine;
  }

  // Add comments if found
  if (comments.length > 0) {
    result.comments = comments;
  }

  // Parse words
  const words = compactLine.match(GCODE_WORD_REGEX) || [];

  for (const word of words) {
    const letter = word[0].toUpperCase();
    const argument = word.slice(1);

    // Special commands
    if (letter === '%') {
      result.cmds = (result.cmds || []).concat(line.trim());
      continue;
    }

    if (letter === '{') {
      result.cmds = (result.cmds || []).concat(line.trim());
      continue;
    }

    if (letter === '$') {
      result.cmds = (result.cmds || []).concat(`${letter}${argument}`);
      continue;
    }

    // Line number
    if (letter === 'N' && ln === undefined) {
      ln = Number(argument);
      continue;
    }

    // Checksum
    if (letter === '*' && cs === undefined) {
      cs = Number(argument);
      continue;
    }

    // Parse value
    let value: number | string = Number(argument);
    if (Number.isNaN(value)) {
      value = argument;
    }

    // Add to words array
    if (flatten) {
      (result.words as string[]).push(letter + value);
    } else {
      (result.words as Array<[string, number | string]>).push([letter, value]);
    }
  }

  // Add line number and checksum if present
  if (ln !== undefined) result.ln = ln;
  if (cs !== undefined) {
    result.cs = cs;
    if (computeChecksum(line) !== cs) {
      result.err = true;
    }
  }

  return result;
}
