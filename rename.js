const fs = require('fs');
const path = require('path');

const excludeDirs = ['node_modules', '.next', 'dist', '.git', 'uploads'];
const excludeExts = ['.pdf', '.jpg', '.png', '.ico', '.tsbuildinfo', '.js', '.map', '.rsc'];

function walkAndReplace(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (excludeDirs.includes(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      walkAndReplace(fullPath);
    } else if (entry.isFile()) {
      if (excludeExts.some(ext => fullPath.endsWith(ext))) continue;

      try {
        let content = fs.readFileSync(fullPath, 'utf8');
        let modified = false;

        // Replace Erode with OpenATS
        if (content.includes('Erode')) {
          content = content.replace(/Erode/g, 'OpenATS');
          modified = true;
        }

        // Replace erode with openats
        if (content.includes('erode')) {
          content = content.replace(/erode/g, 'openats');
          modified = true;
        }

        if (modified) {
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`Updated: ${fullPath}`);
        }
      } catch (err) {
        // Skip binary or locked files
      }
    }
  }
}

walkAndReplace(__dirname);
console.log('Done.');
