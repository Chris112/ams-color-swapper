const fs = require('fs');
const parser = require('gcode-parser');

const gcode = fs.readFileSync('uploads/gcode-1750679628277-907897551.gcode', 'utf8');
const lines = gcode.split('\n').slice(0, 2000); // First 2000 lines

console.log('Parsing first 2000 lines...');

const results = parser.parseStringSync(lines.join('\n'));

// Analyze results
const toolChanges = [];
const layerInfo = [];
const colorInfo = [];

results.forEach((result, index) => {
  const words = result.words;
  
  // Look for tool changes (T commands)
  const tCommand = words.find(w => w[0] === 'T');
  if (tCommand) {
    toolChanges.push({ line: index, tool: `T${tCommand[1]}`, fullLine: result.line });
  }
  
  // Look for M620/M621 (Bambu AMS commands)
  const mCommand = words.find(w => w[0] === 'M');
  if (mCommand && (mCommand[1] === 620 || mCommand[1] === 621)) {
    toolChanges.push({ line: index, ams: `M${mCommand[1]}`, fullLine: result.line });
  }
  
  // Check comments for layer/color info
  if (result.line.includes(';')) {
    const comment = result.line.substring(result.line.indexOf(';'));
    if (comment.includes('layer')) {
      layerInfo.push({ line: index, comment: comment.trim() });
    }
    if (comment.includes('color') || comment.includes('filament_colour')) {
      colorInfo.push({ line: index, comment: comment.trim() });
    }
  }
});

console.log('\nAnalysis Results:');
console.log('================');
console.log(`Tool changes found: ${toolChanges.length}`);
console.log(`Layer markers found: ${layerInfo.length}`);
console.log(`Color definitions found: ${colorInfo.length}`);

console.log('\nFirst 10 tool changes:');
toolChanges.slice(0, 10).forEach(t => {
  console.log(`  Line ${t.line}: ${t.tool || t.ams} - ${t.fullLine.substring(0, 50)}...`);
});

console.log('\nFirst 10 layer markers:');
layerInfo.slice(0, 10).forEach(l => {
  console.log(`  Line ${l.line}: ${l.comment}`);
});

console.log('\nColor definitions:');
colorInfo.forEach(c => {
  console.log(`  Line ${c.line}: ${c.comment}`);
});