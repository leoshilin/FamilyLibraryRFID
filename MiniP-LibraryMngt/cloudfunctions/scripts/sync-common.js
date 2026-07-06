const fs = require('fs');
const path = require('path');

const startTime = Date.now();

const root = path.resolve(__dirname, '..');
const sharedDir = path.join(root, '_shared');

const isDryRun = process.argv.includes('--dry-run');
const isClean = process.argv.includes('--clean');

function log(title = '') {
    console.log(title);
}

function isCloudFunction(dir) {
    return (
        fs.existsSync(path.join(dir, 'index.js')) &&
        fs.existsSync(path.join(dir, 'package.json'))
    );
}

log('========================================');
log(' FamilyLibraryRFID - Sync Common Modules');
log('========================================');
log('');

if (!fs.existsSync(sharedDir)) {
    console.error('ERROR: _shared directory not found.');
    process.exit(1);
}

const sharedFiles = fs.readdirSync(sharedDir);

if (!isClean) {
    log(`Source : ${sharedDir}`);
    log(`Files  : ${sharedFiles.length === 0 ? '(empty)' : sharedFiles.join(', ')}`);
    log('');
}

const synced = [];
const cleaned = [];
const skipped = [];

const folders = fs.readdirSync(root);

for (const folder of folders) {

    const folderPath = path.join(root, folder);

    if (!fs.statSync(folderPath).isDirectory()) {
        continue;
    }

    if (
        folder.startsWith('_') ||
        folder === 'scripts' ||
        folder === 'node_modules'
    ) {
        skipped.push(folder);
        continue;
    }

    if (!isCloudFunction(folderPath)) {
        skipped.push(folder);
        continue;
    }

    const targetCommon = path.join(folderPath, 'common');

    if (isClean) {

        if (fs.existsSync(targetCommon)) {

            if (!isDryRun) {
                fs.rmSync(targetCommon, {
                    recursive: true,
                    force: true
                });
            }

            cleaned.push(folder);

            log(`${isDryRun ? '[DRY]' : '✓'} Removed ${folder}/common`);
        }

        continue;
    }

    if (!isDryRun) {

        fs.rmSync(targetCommon, {
            recursive: true,
            force: true
        });

        fs.cpSync(sharedDir, targetCommon, {
            recursive: true
        });
    }

    synced.push(folder);

    log(`${isDryRun ? '[DRY]' : '✓'} ${folder}`);
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

log('');
log('----------------------------------------');

if (isClean) {

    log(`Mode              : CLEAN`);
    log(`Processed         : ${cleaned.length}`);

} else {

    log(`Mode              : ${isDryRun ? 'DRY RUN' : 'SYNC'}`);
    log(`Shared files      : ${sharedFiles.length}`);
    log(`Cloud Functions   : ${synced.length}`);

}

log(`Skipped           : ${skipped.length}`);
log(`Elapsed           : ${elapsed}s`);

if (skipped.length) {

    log('');
    log('Skipped folders:');

    skipped.forEach(item => {
        log(`  - ${item}`);
    });
}

log('');
log(isDryRun ? 'Dry run completed.' : 'Completed.');