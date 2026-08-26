const fs = require('fs');
const path = require('path');

const srcDir = r'c:\DASHBOARD\dashboard-v2\src';

// Search for any undefined icons or bad imports in src/
function findInFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
            findInFiles(full);
        } else if (f.endsWith('.jsx') || f.endsWith('.js')) {
            const code = fs.readFileSync(full, 'utf8');
            // Check for unclosed tags, bad references
            if (code.includes('undefined')) {
                console.log(`[+] Checked ${f}`);
            }
        }
    }
}

console.log("Checking JS/JSX files...");
findInFiles(r'c:\DASHBOARD\dashboard-v2\src');
