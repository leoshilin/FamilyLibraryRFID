const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sharedDir = path.join(root, '_shared');

console.log('========================================');
console.log(' Sync Common Modules');
console.log('========================================');
console.log('');

if (!fs.existsSync(sharedDir)) {
  console.error('ERROR: _shared directory does not exist.');
  process.exit(1);
}

const folders = fs.readdirSync(root);

let synced = [];
let skipped = [];

for (const folder of folders) {

  const folderPath = path.join(root, folder);

  if (!fs.statSync(folderPath).isDirectory()) {
    continue;
  }

  // 忽略目录
  if (
    folder.startsWith('_') ||
    folder === 'scripts' ||
    folder === 'node_modules'
  ) {
    skipped.push(folder);
    continue;
  }

  // 必须同时存在
  if (
    !fs.existsSync(path.join(folderPath, 'index.js')) ||
    !fs.existsSync(path.join(folderPath, 'package.json'))
  ) {
    skipped.push(folder);
    continue;
  }

  const target = path.join(folderPath, 'common');

  fs.rmSync(target, {
    recursive: true,
    force: true
  });

  fs.cpSync(sharedDir, target, {
    recursive: true
  });

  synced.push(folder);

  console.log(`✓ ${folder}`);
}

console.log('');
console.log('----------------------------------------');

console.log(`Synced : ${synced.length}`);

if (skipped.length) {

  console.log('');
  console.log('Skipped:');

  skipped.forEach(item => {
    console.log(`  - ${item}`);
  });
}

console.log('');
console.log('Finished.');