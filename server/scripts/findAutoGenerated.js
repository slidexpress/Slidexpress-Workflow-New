const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !file.includes('node_modules')) {
      searchDir(fullPath);
    } else if (file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, i) => {
        // Look for lines that SET Auto-generated (with : or =)
        if ((line.includes("'Auto-generated'") || line.includes('"Auto-generated"')) &&
            (line.includes(':') || line.includes('='))) {
          console.log(`${fullPath}:${i+1}: ${line.trim()}`);
        }
      });
    }
  }
}

searchDir(path.join(__dirname, '..'));
