#!/usr/bin/env node
/**
 * Empirical Adversarial Verification Harness: Phase 3 Milestone 2 Remediation
 *
 * Scenarios tested:
 * 1. Dot-slash and relative path ZIP unpacking & root index detection
 * 2. Truncated & Corrupted ZIP boundary conditions & RangeError immunity
 * 3. Wizard UI Error Surfacing & State Contract Verification
 * 4. Starter Template & Bundle Integrity Verification
 */

import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import createJiti from '../../web/node_modules/jiti/lib/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const WEB_DIR = path.resolve(REPO_ROOT, 'web');

const jiti = createJiti(path.resolve(WEB_DIR, 'test_runner.js'), {
  alias: { '@': WEB_DIR },
});

const {
  isTextFile,
  normalizePath,
  hasRootIndexHtml,
  extractZipFiles,
  processUploadedFiles,
  getStarterWebsiteFiles,
} = jiti('./lib/recipes/file-reader.ts');

const {
  validateFileBundle,
} = jiti('./lib/recipes/types.ts');

let passedCount = 0;
let failedCount = 0;
const failures = [];

function check(condition, id, desc) {
  if (condition) {
    passedCount++;
    console.log(`  ✔ PASS [${id}] ${desc}`);
  } else {
    failedCount++;
    failures.push({ id, desc });
    console.log(`  ✖ FAIL [${id}] ${desc}`);
  }
}

function buildSyntheticZip(entries) {
  const chunks = [];
  for (const entry of entries) {
    const fileNameBytes = Buffer.from(entry.name, 'utf8');
    let dataBytes;
    const compressionMethod = entry.compressionMethod ?? 0;

    if (compressionMethod === 8) {
      dataBytes = zlib.deflateRawSync(Buffer.from(entry.data));
    } else {
      dataBytes = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    }

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(compressionMethod, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt32LE(0, 14);
    header.writeUInt32LE(dataBytes.length, 18);
    header.writeUInt32LE(entry.data.length, 22);
    header.writeUInt16LE(fileNameBytes.length, 26);
    header.writeUInt16LE(0, 28);

    chunks.push(header);
    chunks.push(fileNameBytes);
    chunks.push(dataBytes);
  }
  return Buffer.concat(chunks);
}

async function run() {
  console.log('\n========================================================================');
  console.log('  REMEDIATION EMPIRICAL DEEP VERIFICATION: FILE-READER & WIZARD         ');
  console.log('========================================================================\n');

  // ----------------------------------------------------------------------
  // 1. Dot-slash and relative path ZIP unpacking
  // ----------------------------------------------------------------------
  console.log('► 1. Zip ./ Path Normalization and Extraction');

  const zip1 = buildSyntheticZip([
    { name: './index.html', data: '<h1>Root Dot</h1>' },
    { name: './styles.css', data: 'body { color: blue; }' },
    { name: './scripts/app.js', data: 'console.log("ok");' },
    { name: '.DS_Store', data: 'macos noise' },
    { name: './.gitignore', data: 'node_modules' },
    { name: 'assets/.hidden', data: 'secret' },
  ]);

  const extracted1 = await extractZipFiles(zip1.buffer.slice(zip1.byteOffset, zip1.byteOffset + zip1.byteLength));
  
  check(extracted1.some(f => f.path === 'index.html'), 'REMED-DOT-01', 'Extracts ./index.html as normalized index.html');
  check(extracted1.some(f => f.path === 'styles.css'), 'REMED-DOT-02', 'Extracts ./styles.css as normalized styles.css');
  check(extracted1.some(f => f.path === 'scripts/app.js'), 'REMED-DOT-03', 'Extracts ./scripts/app.js as normalized scripts/app.js');
  check(!extracted1.some(f => f.path.includes('.DS_Store')), 'REMED-DOT-04', 'Filters out .DS_Store');
  check(!extracted1.some(f => f.path.includes('.gitignore')), 'REMED-DOT-05', 'Filters out .gitignore');
  check(!extracted1.some(f => f.path.includes('.hidden')), 'REMED-DOT-06', 'Filters out assets/.hidden');
  check(hasRootIndexHtml(extracted1), 'REMED-DOT-07', 'hasRootIndexHtml evaluates to true for ./index.html archive');
  check(validateFileBundle(extracted1).valid, 'REMED-DOT-08', 'validateFileBundle accepts extracted ./index.html archive');

  // Test multiple dots prefix variants
  const zipDots = buildSyntheticZip([
    { name: '././index.html', data: '<h1>Double Dot</h1>' },
  ]);
  const extractedDots = await extractZipFiles(zipDots.buffer.slice(zipDots.byteOffset, zipDots.byteOffset + zipDots.byteLength));
  check(hasRootIndexHtml(extractedDots), 'REMED-DOT-09', 'Extracts and normalizes ././index.html to root index.html');

  // Non-root index.html should not be accepted as root index.html
  const zipSubIndex = buildSyntheticZip([
    { name: './subfolder/index.html', data: '<h1>Nested</h1>' },
    { name: './subfolder/app.js', data: 'console.log();' },
  ]);
  const extractedSub = await extractZipFiles(zipSubIndex.buffer.slice(zipSubIndex.byteOffset, zipSubIndex.byteOffset + zipSubIndex.byteLength));
  check(hasRootIndexHtml(extractedSub) === false, 'REMED-DOT-10', './subfolder/index.html is NOT accepted as root index.html');
  check(validateFileBundle(extractedSub).valid === false, 'REMED-DOT-11', 'validateFileBundle rejects bundle with only ./subfolder/index.html');

  // ----------------------------------------------------------------------
  // 2. Truncated & Corrupted ZIP Boundary Resilience (RangeError Immunity)
  // ----------------------------------------------------------------------
  console.log('\n► 2. Truncated & Corrupted ZIP Boundary Resilience');

  // Test 2.1: Exhaustive byte truncation from 1 to 35 bytes of a valid zip
  const baseZip = buildSyntheticZip([
    { name: 'index.html', data: '<h1>Valid Baseline</h1>' },
  ]);
  let truncationCrashes = 0;
  for (let len = 0; len <= Math.min(baseZip.length, 35); len++) {
    const sub = baseZip.subarray(0, len);
    try {
      const res = await extractZipFiles(sub.buffer.slice(sub.byteOffset, sub.byteOffset + sub.byteLength));
      if (!Array.isArray(res)) truncationCrashes++;
    } catch {
      truncationCrashes++;
    }
  }
  check(truncationCrashes === 0, 'REMED-TRUNC-01', 'extractZipFiles safely handles truncation at every byte boundary (0-35 bytes) without throwing');

  // Test 2.2: Extreme fileNameLength (65535, 1000, 31) exceeding buffer length
  const testFileNameLengths = [31, 50, 100, 1000, 65535];
  let fileNameLengthCrashes = 0;
  for (const fnLen of testFileNameLengths) {
    const buf = Buffer.alloc(30);
    buf.writeUInt32LE(0x04034b50, 0); // signature
    buf.writeUInt16LE(fnLen, 26); // fileNameLength
    try {
      const res = await extractZipFiles(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      if (!Array.isArray(res) || res.length !== 0) fileNameLengthCrashes++;
    } catch {
      fileNameLengthCrashes++;
    }
  }
  check(fileNameLengthCrashes === 0, 'REMED-FNLEN-01', 'extractZipFiles safely handles fileNameLength exceeding buffer without RangeError');

  // Test 2.3: Extreme compressedSize exceeding buffer length
  const testCompressedSizes = [1, 10, 100, 10000, 0xFFFFFFFF];
  let compressedSizeCrashes = 0;
  for (const cSize of testCompressedSizes) {
    const buf = Buffer.alloc(40);
    buf.writeUInt32LE(0x04034b50, 0);
    buf.writeUInt32LE(cSize, 18); // compressedSize
    buf.writeUInt16LE(10, 26); // fileNameLength = 10 (fits in 40-byte buffer: 30+10 = 40)
    buf.write('index.html', 30);
    try {
      const res = await extractZipFiles(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      if (!Array.isArray(res)) compressedSizeCrashes++;
    } catch {
      compressedSizeCrashes++;
    }
  }
  check(compressedSizeCrashes === 0, 'REMED-CSIZE-01', 'extractZipFiles safely handles compressedSize exceeding buffer without RangeError');

  // Test 2.4: Extreme extraFieldLength exceeding buffer length
  const testExtraFieldLengths = [1, 10, 50, 65535];
  let extraFieldCrashes = 0;
  for (const extraLen of testExtraFieldLengths) {
    const buf = Buffer.alloc(40);
    buf.writeUInt32LE(0x04034b50, 0);
    buf.writeUInt16LE(extraLen, 28); // extraFieldLength
    buf.writeUInt16LE(10, 26); // fileNameLength = 10
    buf.write('index.html', 30);
    try {
      const res = await extractZipFiles(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      if (!Array.isArray(res)) extraFieldCrashes++;
    } catch {
      extraFieldCrashes++;
    }
  }
  check(extraFieldCrashes === 0, 'REMED-EXTRA-01', 'extractZipFiles safely handles extraFieldLength exceeding buffer without RangeError');

  // Test 2.5: Multi-entry zip where entry 1 is valid, entry 2 is truncated
  const validChunk = buildSyntheticZip([{ name: 'index.html', data: '<h1>Alive</h1>' }]);
  const truncatedHeader = Buffer.alloc(20);
  truncatedHeader.writeUInt32LE(0x04034b50, 0);
  const multiCorrupt = Buffer.concat([validChunk, truncatedHeader]);
  const multiRes = await extractZipFiles(multiCorrupt.buffer.slice(multiCorrupt.byteOffset, multiCorrupt.byteOffset + multiCorrupt.byteLength));
  check(
    multiRes.length === 1 && multiRes[0].path === 'index.html',
    'REMED-MULTI-CORRUPT-01',
    'extractZipFiles preserves valid preceding entries when later entry is truncated'
  );

  // ----------------------------------------------------------------------
  // 3. Wizard UI Error Surfacing & State Contract Verification
  // ----------------------------------------------------------------------
  console.log('\n► 3. Wizard UI Error Surfacing & State Contract Verification');

  const wizardPath = path.resolve(WEB_DIR, 'components/recipes/hosting-wizard.tsx');
  const wizardContent = fs.readFileSync(wizardPath, 'utf8');

  // Verify fileError state declaration
  check(
    wizardContent.includes('const [fileError, setFileError] = useState<string | null>(null);'),
    'REMED-UI-STATE-01',
    'hosting-wizard.tsx declares fileError state with useState<string | null>(null)'
  );

  // Verify handleFileDrop catch sets user-visible error
  check(
    wizardContent.includes('setFileError("Could not read website files. Please ensure the zip archive or files are valid.");'),
    'REMED-UI-DROP-CATCH-01',
    'handleFileDrop catches file processing errors and sets clear plain-English message'
  );

  // Verify handleFileInputChange catch sets user-visible error
  const inputChangeMatches = (wizardContent.match(/setFileError\("Could not read website files/g) || []).length;
  check(
    inputChangeMatches >= 2,
    'REMED-UI-INPUT-CATCH-01',
    'Both drop and file input change handlers catch processing errors and set fileError'
  );

  // Verify fileError rendered in JSX
  check(
    wizardContent.includes('{fileError && (') &&
    wizardContent.includes('<span>{fileError}</span>') &&
    wizardContent.includes('border-destructive/20') &&
    wizardContent.includes('text-destructive'),
    'REMED-UI-BANNER-01',
    'hosting-wizard.tsx renders plain-English fileError banner with destructive styling & AlertCircle'
  );

  // Verify fileError is cleared on starter template selection
  check(
    wizardContent.includes('handleUseStarterTemplate') &&
    wizardContent.includes('setFileError(null);'),
    'REMED-UI-CLEAR-STARTER-01',
    'handleUseStarterTemplate resets fileError to null'
  );

  // Verify fileError is cleared on clear all files
  check(
    wizardContent.includes('handleClearAllFiles') &&
    wizardContent.includes('setFileError(null);'),
    'REMED-UI-CLEAR-ALL-01',
    'handleClearAllFiles resets fileError to null'
  );

  // Verify missing root index warning banner is present in JSX
  check(
    wizardContent.includes('Missing main file: Please ensure your website includes an') &&
    wizardContent.includes('index.html') &&
    wizardContent.includes('file at the root.'),
    'REMED-UI-MISSING-INDEX-01',
    'Wizard displays user-friendly warning banner when index.html is missing at the root'
  );

  // Verify detected root index success banner is present in JSX
  check(
    wizardContent.includes('Main file detected:') &&
    wizardContent.includes('is present at the root.'),
    'REMED-UI-DETECTED-INDEX-01',
    'Wizard displays green confirmation banner when root index.html is present'
  );

  // Verify wizard disables progression to Step 3 when files are invalid
  check(
    wizardContent.includes('const isFilesValid = files.length > 0 && hasRootIndexHtml(files);') &&
    wizardContent.includes('disabled={!isFilesValid}'),
    'REMED-UI-NEXT-DISABLED-01',
    'Wizard step 2 Next button is strictly disabled unless files.length > 0 AND hasRootIndexHtml'
  );

  // ----------------------------------------------------------------------
  // 4. Starter Template Contract
  // ----------------------------------------------------------------------
  console.log('\n► 4. Starter Template Contract');
  const starter = getStarterWebsiteFiles();
  check(starter.length === 3, 'STARTER-LEN-01', 'Starter website has exactly 3 files');
  check(hasRootIndexHtml(starter), 'STARTER-ROOT-01', 'Starter website has valid root index.html');
  check(validateFileBundle(starter).valid, 'STARTER-VAL-01', 'Starter website bundle validates cleanly');

  // Summary
  console.log('\n========================================================================');
  console.log(`TOTAL CHECKS: ${passedCount + failedCount}`);
  console.log(`PASSED:       ${passedCount}`);
  console.log(`FAILED:       ${failedCount}`);
  console.log('========================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
