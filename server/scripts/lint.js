/**
 * Runs Node syntax verification on all backend files and executes ESLint
 * using the workspace eslint installation when available.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SERVER_ROOT = path.resolve(__dirname, '..');
const SOURCE_DIRS = ['config', 'db', 'middleware', 'routes', 'services', 'scripts', 'tests'];
const ROOT_FILES = [
  'server.js',
  'app.js',
  'material_matcher.js',
  'production_pipeline.js',
  'pipeline_sync_daemon.js',
  'ruida_monitor.js',
  'seed_demo_account.js'
];

function collectServerFiles() {
  const files = [];
  for (const rel of ROOT_FILES) {
    const abs = path.join(SERVER_ROOT, rel);
    if (fs.existsSync(abs)) files.push(abs);
  }
  for (const dir of SOURCE_DIRS) {
    const dirPath = path.join(SERVER_ROOT, dir);
    if (!fs.existsSync(dirPath)) continue;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(path.join(dirPath, entry.name));
      }
    }
  }
  return files;
}

async function main() {
  const files = collectServerFiles();
  for (const file of files) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  }

  const eslintDir = path.resolve(SERVER_ROOT, '../dashboard-v2/node_modules');
  const eslintPkg = path.join(eslintDir, 'eslint');
  if (!fs.existsSync(eslintPkg)) {
    console.log(`Syntax checked ${files.length} server files (ESLint skipped: dashboard-v2/node_modules not present).`);
    return;
  }

  const { ESLint } = require(eslintPkg);
  const js = require(path.join(eslintDir, '@eslint/js'));
  const globals = require(path.join(eslintDir, 'globals'));

  const eslint = new ESLint({
    cwd: SERVER_ROOT,
    overrideConfigFile: true,
    overrideConfig: [
      js.configs.recommended,
      {
        languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: globals.node },
        rules: {
          'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }]
        }
      }
    ]
  });

  const results = await eslint.lintFiles(files);
  const formatter = await eslint.loadFormatter('stylish');
  const output = formatter.format(results);
  if (output.trim()) console.log(output);

  const issueCount = results.reduce((sum, r) => sum + r.errorCount + r.warningCount, 0);
  if (issueCount > 0) {
    console.error(`Server ESLint failed with ${issueCount} issue(s).`);
    process.exit(1);
  }
  console.log(`Server lint passed: ${files.length} files checked, 0 errors, 0 warnings.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
