import { Transform, TransformCallback } from 'stream';
import { EventEmitter } from 'events';
import fs from 'fs';
import readline from 'readline';
import { GcodeStats, ToolChange } from '../types';
import { Logger } from '../debug/logger';
import { calculateStatistics } from './statistics';

// Line processing modes
export enum LineMode {
  ORIGINAL = 'original',  // Keep line as-is
  STRIPPED = 'stripped',  // Remove comments, trim whitespace
  COMPACT = 'compact'     // Remove comments and all whitespace
}

// Parsed line result
export interface ParsedLine {
  line: string;
  words: Array<[string, number | string]> | string[];
  comments?: string[];
  ln?: number;  // Line number (N command)
  cs?: number;  // Checksum
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
const GCODE_WORD_REGEX = /(%.*)|({.*)|((?:\$\$)|(?:\$[a-zA-Z0-9#]*))|([a-zA-Z][0-9\+\-\.]+)|(\*[0-9]+)/igm;

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
    s = s.substr(0, s.lastIndexOf('*'));
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
    words: []
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

// Transform stream for parsing G-code lines
export class GCodeLineStream extends Transform {
  private state = {
    lineCount: 0,
    lastChunkEndedWithCR: false
  };
  
  private options: Required<ParserOptions>;
  private lineBuffer = '';
  private lineEndRegex = /.*(?:\r\n|\r|\n)|.+$/g;
  
  constructor(options: ParserOptions = {}) {
    super({ objectMode: true });
    
    this.options = {
      batchSize: options.batchSize ?? 1000,
      flatten: options.flatten ?? false,
      lineMode: options.lineMode ?? LineMode.ORIGINAL,
      enableEvents: options.enableEvents ?? true
    };
  }
  
  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    // Convert buffer to string
    if (Buffer.isBuffer(chunk)) {
      chunk = chunk.toString('utf8');
    }
    
    this.lineBuffer += chunk;
    
    // Check if chunk contains line endings
    if (!this.containsLineEnd(chunk)) {
      callback();
      return;
    }
    
    const lines = this.lineBuffer.match(this.lineEndRegex);
    if (!lines || lines.length === 0) {
      callback();
      return;
    }
    
    // Handle CRLF spanning chunks
    if (this.state.lastChunkEndedWithCR && lines[0] === '\n') {
      lines.shift();
    }
    
    this.state.lastChunkEndedWithCR = this.lineBuffer[this.lineBuffer.length - 1] === '\r';
    
    // Update line buffer
    if (this.lineBuffer[this.lineBuffer.length - 1] === '\r' || 
        this.lineBuffer[this.lineBuffer.length - 1] === '\n') {
      this.lineBuffer = '';
    } else {
      const lastLine = lines.pop() || '';
      this.lineBuffer = lastLine;
    }
    
    // Process lines in batches
    this.processLinesBatch(lines, 0, callback);
  }
  
  _flush(callback: TransformCallback): void {
    if (this.lineBuffer) {
      const line = this.lineBuffer.trim();
      if (line.length > 0) {
        const result = parseLine(line, this.options);
        this.push(result);
      }
      this.lineBuffer = '';
      this.state.lastChunkEndedWithCR = false;
    }
    callback();
  }
  
  private containsLineEnd(str: string): boolean {
    return /.*(?:\r\n|\r|\n)/g.test(str);
  }
  
  private processLinesBatch(lines: string[], index: number, callback: TransformCallback): void {
    const batchSize = this.options.batchSize;
    let count = 0;
    
    for (let i = index; i < lines.length && count < batchSize; i++, count++) {
      const line = lines[i].trim();
      if (line.length > 0) {
        this.state.lineCount++;
        const result = parseLine(line, this.options);
        this.push(result);
      }
    }
    
    if (index + count < lines.length) {
      // Process next batch
      setImmediate(() => this.processLinesBatch(lines, index + count, callback));
    } else {
      callback();
    }
  }
}

// Enhanced G-code parser with event emitter
export class EnhancedGcodeParser extends EventEmitter {
  private logger: Logger;
  private stats: Partial<GcodeStats>;
  private currentLayer: number = 0;
  private currentZ: number = 0;
  private currentTool: string = 'T0';
  private toolChanges: ToolChange[] = [];
  private layerColorMap: Map<number, string> = new Map();
  private colorFirstSeen: Map<string, number> = new Map();
  private colorLastSeen: Map<string, number> = new Map();
  private lineNumber: number = 0;
  private startTime: number = 0;
  private options: ParserOptions;
  
  constructor(logger?: Logger, options: ParserOptions = {}) {
    super();
    this.logger = logger || new Logger();
    this.options = options;
    this.stats = {
      toolChanges: [],
      layerColorMap: new Map(),
      parserWarnings: [],
      colors: []
    };
  }
  
  // Parse file using stream
  async parseFile(filePath: string, fileName: string): Promise<GcodeStats> {
    return new Promise((resolve, reject) => {
      this.startParsing(fileName);
      
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const lineStream = new GCodeLineStream(this.options);
      
      stream.on('error', reject);
      
      lineStream.on('data', (parsed: ParsedLine) => {
        this.lineNumber++;
        this.processParseResults(parsed);
      });
      
      lineStream.on('end', async () => {
        const stats = await this.finalizeParsing();
        resolve(stats);
      });
      
      lineStream.on('error', reject);
      
      stream.pipe(lineStream);
    });
  }
  
  // Parse string synchronously
  parseStringSync(gcode: string): ParsedLine[] {
    const results: ParsedLine[] = [];
    const lines = gcode.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      
      const result = parseLine(trimmed, this.options);
      results.push(result);
    }
    
    return results;
  }
  
  // Parse using readline (backward compatibility)
  async parse(filePath: string, fileName: string): Promise<GcodeStats> {
    this.startParsing(fileName);
    
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    for await (const line of rl) {
      this.lineNumber++;
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      
      const parsed = parseLine(trimmed, this.options);
      this.processParseResults(parsed);
    }
    
    return this.finalizeParsing();
  }
  
  private startParsing(fileName: string) {
    this.startTime = Date.now();
    this.logger.info(`Starting G-code parse for ${fileName}`);
    this.stats.fileName = fileName;
    
    // Initialize layer 0
    this.layerColorMap.set(0, this.currentTool);
    this.updateColorSeen(this.currentTool, 0);
    
    if (this.options.enableEvents) {
      this.emit('start', { fileName });
    }
  }
  
  private processParseResults(parsed: ParsedLine) {
    // Process comments
    if (parsed.comments) {
      for (const comment of parsed.comments) {
        this.processComment(comment);
      }
    }
    
    // Process G-code words
    if (parsed.words.length > 0) {
      const words = this.options.flatten 
        ? (parsed.words as string[]).map(w => [w[0], w.slice(1)])
        : parsed.words as Array<[string, number | string]>;
      
      // Get command letter
      const firstWord = words[0];
      const command = Array.isArray(firstWord) ? firstWord[0] : firstWord[0];
      
      switch (command) {
        case 'G':
          this.processGCommand(words);
          break;
        case 'M':
          this.processMCommand(words);
          break;
        case 'T':
          this.processTCommand(words);
          break;
      }
    }
    
    // Process special commands
    if (parsed.cmds) {
      for (const cmd of parsed.cmds) {
        if (this.options.enableEvents) {
          this.emit('command', { command: cmd, line: parsed.line });
        }
      }
    }
    
    // Emit line event
    if (this.options.enableEvents) {
      this.emit('line', { lineNumber: this.lineNumber, parsed });
    }
  }
  
  private processComment(comment: string) {
    // Color definitions
    if (comment.includes('extruder_colour') || comment.includes('filament_colour')) {
      const colorMatch = comment.match(/= (.+)/);
      if (colorMatch) {
        const colors = colorMatch[1].split(';');
        this.logger.info(`Found ${colors.length} color definitions`);
        if (!this.stats.slicerInfo) {
          this.stats.slicerInfo = { software: 'Unknown', version: 'Unknown' };
        }
        this.stats.slicerInfo.colorDefinitions = colors;
      }
    }
    
    // Slicer info
    if (comment.includes('generated by')) {
      const slicerMatch = comment.match(/generated by (.+?) ([\d.]+)/i);
      if (slicerMatch) {
        if (!this.stats.slicerInfo) {
          this.stats.slicerInfo = {
            software: slicerMatch[1],
            version: slicerMatch[2]
          };
        }
        this.logger.info(`Detected slicer: ${slicerMatch[1]} v${slicerMatch[2]}`);
      }
    }
    
    // Layer changes
    this.detectLayerChange(comment);
    
    // Filament usage
    if (comment.includes('filament used')) {
      const filamentMatch = comment.match(/filament used.*?(\d+\.?\d*)\s*mm/i);
      if (filamentMatch) {
        const length = parseFloat(filamentMatch[1]);
        if (!this.stats.filamentEstimates) {
          this.stats.filamentEstimates = [];
        }
        this.stats.filamentEstimates.push({
          colorId: this.currentTool,
          length
        });
      }
    }
    
    // Print time
    if (comment.includes('estimated printing time')) {
      const timeMatch = comment.match(/(\d+)h\s*(\d+)m\s*(\d+)s/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseInt(timeMatch[3]);
        this.stats.estimatedPrintTime = hours * 3600 + minutes * 60 + seconds;
        this.logger.info(`Estimated print time: ${hours}h ${minutes}m ${seconds}s`);
      }
    }
  }
  
  private detectLayerChange(comment: string) {
    let layerMatch = null;
    
    // Various layer formats
    if (comment.includes('layer num/total_layer_count:')) {
      layerMatch = comment.match(/layer num\/total_layer_count:\s*(\d+)/);
    } else if (comment.includes('layer #')) {
      layerMatch = comment.match(/layer #(\d+)/);
    } else if (comment.includes('LAYER:') || comment.includes('layer ')) {
      layerMatch = comment.match(/(?:LAYER:|layer )\s*(\d+)/i);
    }
    
    if (layerMatch) {
      const newLayer = parseInt(layerMatch[1]);
      if (newLayer !== this.currentLayer) {
        this.currentLayer = newLayer;
        this.layerColorMap.set(this.currentLayer, this.currentTool);
        this.updateColorSeen(this.currentTool, this.currentLayer);
        this.logger.debug(`Layer ${this.currentLayer} - Tool: ${this.currentTool}`);
        
        if (this.options.enableEvents) {
          this.emit('layer', { 
            layer: this.currentLayer, 
            tool: this.currentTool,
            z: this.currentZ 
          });
        }
      }
    }
  }
  
  private processGCommand(words: Array<[string, number | string]> | Array<string>) {
    const gValue = this.getWordValue(words, 'G');
    if (gValue === 0 || gValue === 1) {
      // Process movement
      const z = this.getWordValue(words, 'Z');
      if (z !== null && typeof z === 'number') {
        if (z > this.currentZ) {
          this.currentZ = z;
          if (!this.stats.totalHeight || z > this.stats.totalHeight) {
            this.stats.totalHeight = z;
          }
        }
      }
    }
  }
  
  private processMCommand(words: Array<[string, number | string]> | Array<string>) {
    const mValue = this.getWordValue(words, 'M');
    if (mValue === 600) {
      this.logger.warn(`Manual filament change detected at layer ${this.currentLayer}, line ${this.lineNumber}`);
      this.stats.parserWarnings?.push(
        `M600 filament change at layer ${this.currentLayer} (line ${this.lineNumber})`
      );
      
      if (this.options.enableEvents) {
        this.emit('filamentChange', { 
          layer: this.currentLayer,
          lineNumber: this.lineNumber,
          z: this.currentZ
        });
      }
    }
  }
  
  private processTCommand(words: Array<[string, number | string]> | Array<string>) {
    const tValue = this.getWordValue(words, 'T');
    if (tValue !== null) {
      const tool = `T${tValue}`;
      if (tool !== this.currentTool) {
        const change: ToolChange = {
          fromTool: this.currentTool,
          toTool: tool,
          layer: this.currentLayer,
          lineNumber: this.lineNumber,
          zHeight: this.currentZ
        };
        
        this.toolChanges.push(change);
        this.logger.info(`Tool change: ${this.currentTool} → ${tool} at layer ${this.currentLayer}`);
        
        this.currentTool = tool;
        
        if (this.options.enableEvents) {
          this.emit('toolChange', change);
        }
      }
    }
  }
  
  private getWordValue(words: Array<[string, number | string]> | Array<string>, letter: string): number | string | null {
    for (const word of words) {
      if (Array.isArray(word)) {
        if (word[0] === letter) return word[1];
      } else {
        if (word[0] === letter) {
          const value = word.slice(1);
          const num = Number(value);
          return Number.isNaN(num) ? value : num;
        }
      }
    }
    return null;
  }
  
  private updateColorSeen(tool: string, layer: number) {
    if (!this.colorFirstSeen.has(tool)) {
      this.colorFirstSeen.set(tool, layer);
    }
    this.colorLastSeen.set(tool, layer);
  }
  
  private async finalizeParsing(): Promise<GcodeStats> {
    const parseTime = Date.now() - this.startTime;
    this.logger.info(`Parse completed in ${parseTime}ms`);
    
    const completeStats = await calculateStatistics(
      this.stats as GcodeStats,
      this.toolChanges,
      this.layerColorMap,
      this.colorFirstSeen,
      this.colorLastSeen,
      parseTime
    );
    
    if (this.options.enableEvents) {
      this.emit('end', completeStats);
    }
    
    return completeStats;
  }
}