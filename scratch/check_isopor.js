const db = require('better-sqlite3')('server/mach3.db');
const jobs = db.prepare("SELECT id, file_name, file_path, folder FROM jobs WHERE file_path LIKE '%ISOPOR%'").all();
console.log(JSON.stringify(jobs, null, 2));
console.log(`\nTotal jobs found: ${jobs.length}`);
