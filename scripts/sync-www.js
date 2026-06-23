const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WWW_DIR = path.join(ROOT, 'www');
const FRONTEND_SRC = path.join(ROOT, 'src', 'frontend');
const FRONTEND_DEST = path.join(WWW_DIR, 'src', 'frontend');

const ROOT_FILES = [
  'index.html',
  'app.js',
  'styles.css',
  'manifest.json',
  'sw.js',
  'worker.js',
  'icon.svg',
  'icon-maskable.svg',
  'privacy.html',
  'terms.html',
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${path.relative(ROOT, src)} -> ${path.relative(ROOT, dest)}`);
}

function cleanJsFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith('.js')) {
      fs.unlinkSync(fullPath);
      console.log(`Removed old: ${path.relative(ROOT, fullPath)}`);
    }
  }
}

function syncFrontendJsFiles(srcDir, destDir) {
  ensureDir(destDir);
  cleanJsFiles(destDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.js')) {
      copyFile(path.join(srcDir, entry.name), path.join(destDir, entry.name));
    }
  }
}

function main() {
  ensureDir(WWW_DIR);

  for (const file of ROOT_FILES) {
    const src = path.join(ROOT, file);
    const dest = path.join(WWW_DIR, file);
    if (fs.existsSync(src)) {
      copyFile(src, dest);
    } else {
      console.warn(`Skipping missing file: ${file}`);
    }
  }

  syncFrontendJsFiles(FRONTEND_SRC, FRONTEND_DEST);

  console.log('www sync complete.');
}

main();
