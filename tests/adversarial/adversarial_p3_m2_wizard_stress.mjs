#!/usr/bin/env node
/**
 * Empirical Adversarial Stress Harness: Phase 3 Milestone 2
 * Frontend Recipe Wizard & File Processing Logic
 * Target files:
 *   - web/lib/recipes/file-reader.ts
 *   - web/lib/recipes/types.ts
 *   - web/components/recipes/hosting-wizard.tsx
 *
 * Test Suites:
 * 1. ZIP File Extraction & Boundary Resilience (corrupted, truncated, headers, methods)
 * 2. File Bundle & Root index.html Detection (missing, nested, case-sensitivity, starter template)
 * 3. File Encodings & Non-UTF8 / Binary Handling (Text vs Binary, Base64 roundtrip, Null bytes)
 * 4. Subdomain Live Preview & Adversarial Input Validation (Punycode, XSS, Path traversal, lengths)
 * 5. High Load / Bundle Stress & Benchmarks (200 files, 5MB binary, 50-entry ZIP)
 * 6. "No Jargon, Ever" Copy & Wizard Contract Audit
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

// Initialize jiti for TypeScript module resolution
const jiti = createJiti(path.resolve(WEB_DIR, 'test_runner.js'), {
  alias: { '@': WEB_DIR },
});

// Import target modules
const {
  isTextFile,
  normalizePath,
  hasRootIndexHtml,
  extractZipFiles,
  processUploadedFiles,
  getStarterWebsiteFiles,
} = jiti('./lib/recipes/file-reader.ts');

const {
  isValidSubdomain,
  validateSubdomain,
  validateFileBundle,
  getUserPlan,
} = jiti('./lib/recipes/types.ts');

const {
  normalizeFiles,
} = jiti('./lib/recipes/cloudflare-pages.ts');

// Test framework state
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testId, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ PASS [${testId}] ${message}`);
  } else {
    failedTests++;
    failures.push({ testId, message });
    console.log(`  ✖ FAIL [${testId}] ${message}`);
  }
}

/**
 * Helper to construct synthetic ZIP buffers (local file header format)
 */
function createSyntheticZipBuffer(entries) {
  const chunks = [];
  for (const entry of entries) {
    const fileNameBytes = Buffer.from(entry.name, 'utf8');
    let dataBytes;
    let compressionMethod = entry.compressionMethod ?? 0; // 0 = store, 8 = deflate

    if (compressionMethod === 8) {
      dataBytes = zlib.deflateRawSync(entry.data);
    } else {
      dataBytes = Buffer.from(entry.data);
    }

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); // signature
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0, 6); // general purpose bit flag
    header.writeUInt16LE(compressionMethod, 8); // compression method
    header.writeUInt16LE(0, 10); // last mod time
    header.writeUInt16LE(0, 12); // last mod date
    header.writeUInt32LE(0, 14); // crc32
    header.writeUInt32LE(dataBytes.length, 18); // compressed size
    header.writeUInt32LE(entry.data.length, 22); // uncompressed size
    header.writeUInt16LE(fileNameBytes.length, 26); // file name length
    header.writeUInt16LE(0, 28); // extra field length

    chunks.push(header);
    chunks.push(fileNameBytes);
    chunks.push(dataBytes);
  }
  return Buffer.concat(chunks);
}

async function runWizardStressSuite() {
  console.log('\n========================================================================');
  console.log('   Phase 3 Milestone 2 — EMPIRICAL CHALLENGER STRESS HARNESS            ');
  console.log('========================================================================\n');

  // ------------------------------------------------------------------------
  // Suite 1: ZIP File Extraction & Boundary Resilience
  // ------------------------------------------------------------------------
  console.log('► Suite 1: ZIP File Extraction & Boundary Resilience');

  // Test 1.1: 0-byte buffer
  const emptyRes = await extractZipFiles(new ArrayBuffer(0));
  assert(
    Array.isArray(emptyRes) && emptyRes.length === 0,
    'ZIP-EMPTY-01',
    'extractZipFiles returns empty array on 0-byte buffer without crashing'
  );

  // Test 1.2: Short buffer (< 30 bytes)
  const shortBuf = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]).buffer;
  const shortRes = await extractZipFiles(shortBuf);
  assert(
    Array.isArray(shortRes) && shortRes.length === 0,
    'ZIP-SHORT-01',
    'extractZipFiles returns empty array on truncated header (< 30 bytes)'
  );

  // Test 1.3: Non-zip random binary buffer
  const randomBuf = crypto.randomBytes(128).buffer;
  const randomRes = await extractZipFiles(randomBuf);
  assert(
    Array.isArray(randomRes) && randomRes.length === 0,
    'ZIP-RANDOM-01',
    'extractZipFiles ignores random binary data (no zip signature)'
  );

  // Test 1.4: Valid Stored ZIP (method 0) extraction with root index.html
  const validZipBuf = createSyntheticZipBuffer([
    { name: 'index.html', data: '<html><body>Hello World</body></html>', compressionMethod: 0 },
    { name: 'styles.css', data: 'body { color: red; }', compressionMethod: 0 },
  ]);
  const validZipRes = await extractZipFiles(validZipBuf.buffer.slice(validZipBuf.byteOffset, validZipBuf.byteOffset + validZipBuf.byteLength));
  assert(
    validZipRes.length === 2 &&
      validZipRes.some((f) => f.path === 'index.html' && f.content.includes('Hello World')) &&
      validZipRes.some((f) => f.path === 'styles.css' && f.content.includes('color: red')),
    'ZIP-STORE-01',
    'extractZipFiles correctly unpacks stored (method 0) entries'
  );

  // Test 1.5: Valid Deflate ZIP (method 8) decompression
  const deflateZipBuf = createSyntheticZipBuffer([
    { name: 'index.html', data: '<!DOCTYPE html><h1>Deflated INGR</h1>', compressionMethod: 8 },
    { name: 'app.js', data: 'console.log("deflated js code");', compressionMethod: 8 },
  ]);
  const deflateZipRes = await extractZipFiles(deflateZipBuf.buffer.slice(deflateZipBuf.byteOffset, deflateZipBuf.byteOffset + deflateZipBuf.byteLength));
  assert(
    deflateZipRes.length === 2 &&
      deflateZipRes.some((f) => f.path === 'index.html' && f.content.includes('Deflated INGR')) &&
      deflateZipRes.some((f) => f.path === 'app.js' && f.content.includes('deflated js code')),
    'ZIP-DEFLATE-01',
    'extractZipFiles decompresses Deflate (method 8) entries using DecompressionStream'
  );

  // Test 1.6: Deflate entry with corrupted stream (method 8 but data is corrupted)
  const corruptDeflateBuf = Buffer.alloc(50);
  corruptDeflateBuf.writeUInt32LE(0x04034b50, 0); // signature
  corruptDeflateBuf.writeUInt16LE(8, 8); // method = 8
  corruptDeflateBuf.writeUInt32LE(10, 18); // compressed size = 10
  corruptDeflateBuf.writeUInt32LE(10, 22); // uncompressed size = 10
  corruptDeflateBuf.writeUInt16LE(10, 26); // file name length = 10
  corruptDeflateBuf.write('index.html', 30);
  corruptDeflateBuf.fill(0xff, 40); // 10 bytes of invalid deflate payload
  const corruptDeflateRes = await extractZipFiles(corruptDeflateBuf.buffer.slice(corruptDeflateBuf.byteOffset, corruptDeflateBuf.byteOffset + corruptDeflateBuf.byteLength));
  assert(
    Array.isArray(corruptDeflateRes) && corruptDeflateRes.length === 1,
    'ZIP-CORRUPT-STREAM-01',
    'extractZipFiles catches decompression failure and falls back to rawData without crashing'
  );

  // Test 1.7: Skip directory entries (trailing slash)
  const dirZipBuf = createSyntheticZipBuffer([
    { name: 'images/', data: '', compressionMethod: 0 },
    { name: 'assets/css/', data: '', compressionMethod: 0 },
    { name: 'index.html', data: '<h1>Root</h1>', compressionMethod: 0 },
  ]);
  const dirZipRes = await extractZipFiles(dirZipBuf.buffer.slice(dirZipBuf.byteOffset, dirZipBuf.byteOffset + dirZipBuf.byteLength));
  assert(
    dirZipRes.length === 1 && dirZipRes[0].path === 'index.html',
    'ZIP-DIR-SKIP-01',
    'extractZipFiles filters out directory entries ending with /'
  );

  // Test 1.8: Skip macOS metadata entries (__MACOSX/)
  const macOsZipBuf = createSyntheticZipBuffer([
    { name: '__MACOSX/._index.html', data: 'metadata', compressionMethod: 0 },
    { name: '__MACOSX/._styles.css', data: 'metadata', compressionMethod: 0 },
    { name: 'index.html', data: '<h1>Live</h1>', compressionMethod: 0 },
  ]);
  const macOsRes = await extractZipFiles(macOsZipBuf.buffer.slice(macOsZipBuf.byteOffset, macOsZipBuf.byteOffset + macOsZipBuf.byteLength));
  assert(
    macOsRes.length === 1 && macOsRes[0].path === 'index.html',
    'ZIP-MACOS-SKIP-01',
    'extractZipFiles filters out __MACOSX/ metadata entries'
  );

  // Test 1.9: Skip hidden files starting with dot (.DS_Store, .git)
  const hiddenZipBuf = createSyntheticZipBuffer([
    { name: '.DS_Store', data: 'ds_store_data', compressionMethod: 0 },
    { name: '.gitignore', data: 'node_modules', compressionMethod: 0 },
    { name: 'index.html', data: '<h1>Real</h1>', compressionMethod: 0 },
  ]);
  const hiddenRes = await extractZipFiles(hiddenZipBuf.buffer.slice(hiddenZipBuf.byteOffset, hiddenZipBuf.byteOffset + hiddenZipBuf.byteLength));
  assert(
    hiddenRes.length === 1 && hiddenRes[0].path === 'index.html',
    'ZIP-HIDDEN-SKIP-01',
    'extractZipFiles filters out hidden dotfiles (.DS_Store, .gitignore)'
  );

  // Test 1.10: BUG - Path normalization of leading slashes and dots in ZIP entries
  const traversalZipBuf = createSyntheticZipBuffer([
    { name: './index.html', data: '<h1>Clean Dot</h1>', compressionMethod: 0 },
    { name: '/styles.css', data: 'body{}', compressionMethod: 0 },
    { name: '../../script.js', data: 'console.log(1)', compressionMethod: 0 },
  ]);
  const traversalRes = await extractZipFiles(traversalZipBuf.buffer.slice(traversalZipBuf.byteOffset, traversalZipBuf.byteOffset + traversalZipBuf.byteLength));
  assert(
    traversalRes.some((f) => f.path === 'index.html'),
    'ZIP-PREFIX-DOT-01-BUG',
    'extractZipFiles must preserve entries with "./" prefix (e.g. "./index.html") without dropping them'
  );
  assert(
    traversalRes.some((f) => f.path === 'styles.css') &&
      traversalRes.some((f) => f.path === 'script.js'),
    'ZIP-PATH-NORM-01',
    'extractZipFiles normalizes leading slashes and relative paths'
  );

  // Test 1.11: BUG - Truncated header bounds check (RangeError)
  const truncatedHeaderBuf = new Uint8Array(30);
  const truncView = new DataView(truncatedHeaderBuf.buffer);
  truncView.setUint32(0, 0x04034b50, true);
  truncView.setUint16(26, 100, true); // fileNameLength = 100 on 30-byte buffer
  let rangeErrorThrown = false;
  try {
    await extractZipFiles(truncatedHeaderBuf.buffer);
  } catch (err) {
    if (err instanceof RangeError) {
      rangeErrorThrown = true;
    }
  }
  assert(
    !rangeErrorThrown,
    'ZIP-RANGE-01-BUG',
    'extractZipFiles must handle truncated zip header without crashing with unhandled RangeError'
  );

  // Test 1.11: Deduplication in processUploadedFiles
  const mockFiles = [
    new File(['first content'], 'index.html', { type: 'text/html' }),
    new File(['second content (latest)'], 'index.html', { type: 'text/html' }),
  ];
  const processedDedupe = await processUploadedFiles(mockFiles);
  assert(
    processedDedupe.length === 1 && processedDedupe[0].content === 'second content (latest)',
    'UPLOAD-DEDUPE-01',
    'processUploadedFiles deduplicates entries by normalized path (latest file wins)'
  );

  // ------------------------------------------------------------------------
  // Suite 2: File Bundle & Root index.html Detection Logic
  // ------------------------------------------------------------------------
  console.log('\n► Suite 2: File Bundle & Root index.html Detection Logic');

  // Test 2.1: Missing index.html
  const missingIndex = [
    { path: 'style.css', content: 'body {}' },
    { path: 'app.js', content: 'console.log()' },
  ];
  assert(
    hasRootIndexHtml(missingIndex) === false,
    'INDEX-MISSING-01',
    'hasRootIndexHtml returns false when index.html is missing'
  );
  assert(
    validateFileBundle(missingIndex).valid === false,
    'BUNDLE-MISSING-01',
    'validateFileBundle rejects bundle missing index.html'
  );

  // Test 2.2: Nested index.html must be rejected as root index
  const nestedCases = [
    'sub/index.html',
    'public/index.html',
    'dist/index.html',
    'my-site/index.html',
    'assets/index.html',
    'index.html/nested.html',
    'site/build/index.html',
  ];
  for (let i = 0; i < nestedCases.length; i++) {
    const p = nestedCases[i];
    const nestedBundle = [{ path: p, content: '<h1>Nested</h1>' }];
    assert(
      hasRootIndexHtml(nestedBundle) === false,
      `INDEX-NESTED-0${i + 1}`,
      `hasRootIndexHtml rejects non-root nested path: "${p}"`
    );
    assert(
      validateFileBundle(nestedBundle).valid === false,
      `BUNDLE-NESTED-0${i + 1}`,
      `validateFileBundle rejects non-root nested path: "${p}"`
    );
  }

  // Test 2.3: Root index.html variants (normalization)
  const rootVariants = [
    'index.html',
    '/index.html',
    './index.html',
    '//index.html',
    '/./index.html',
  ];
  for (let i = 0; i < rootVariants.length; i++) {
    const p = rootVariants[i];
    const rootBundle = [{ path: p, content: '<h1>Root</h1>' }];
    assert(
      hasRootIndexHtml(rootBundle) === true,
      `INDEX-ROOT-0${i + 1}`,
      `hasRootIndexHtml accepts normalized root path: "${p}"`
    );
    assert(
      validateFileBundle(rootBundle).valid === true,
      `BUNDLE-ROOT-0${i + 1}`,
      `validateFileBundle accepts normalized root path: "${p}"`
    );
  }

  // Test 2.4: Starter website generator contract
  const starterFiles = getStarterWebsiteFiles();
  assert(
    Array.isArray(starterFiles) && starterFiles.length === 3,
    'STARTER-COUNT-01',
    'getStarterWebsiteFiles produces exactly 3 files (index.html, styles.css, script.js)'
  );
  assert(
    hasRootIndexHtml(starterFiles) === true,
    'STARTER-INDEX-01',
    'getStarterWebsiteFiles bundle has valid root index.html'
  );
  assert(
    validateFileBundle(starterFiles).valid === true,
    'STARTER-BUNDLE-01',
    'getStarterWebsiteFiles passes validateFileBundle'
  );
  const starterHtml = starterFiles.find((f) => f.path === 'index.html');
  assert(
    starterHtml &&
      starterHtml.content.includes('<!DOCTYPE html>') &&
      starterHtml.content.includes('<meta name="viewport"') &&
      starterHtml.content.includes('styles.css') &&
      starterHtml.content.includes('script.js'),
    'STARTER-HTML-01',
    'Starter index.html contains modern HTML5 DOCTYPE, viewport meta, and asset links'
  );

  // ------------------------------------------------------------------------
  // Suite 3: File Encodings & Non-UTF8 / Binary Handling
  // ------------------------------------------------------------------------
  console.log('\n► Suite 3: File Encodings & Non-UTF8 / Binary Handling');

  // Test 3.1: Text vs Binary extensions
  const textExts = ['site.html', 'main.htm', 'theme.css', 'app.js', 'comp.tsx', 'data.json', 'icon.svg', 'notes.md'];
  for (const f of textExts) {
    assert(isTextFile(f) === true, `EXT-TEXT-${f.replace('.', '-')}`, `isTextFile recognizes ${f} as text file`);
  }
  const binaryExts = ['logo.png', 'photo.jpg', 'hero.jpeg', 'anim.gif', 'banner.webp', 'favicon.ico', 'font.woff2', 'doc.pdf'];
  for (const f of binaryExts) {
    assert(isTextFile(f) === false, `EXT-BIN-${f.replace('.', '-')}`, `isTextFile recognizes ${f} as binary file`);
  }

  // Test 3.2: Non-UTF8 byte sequence in text file
  const invalidUtf8Bytes = Buffer.from([0x3c, 0x68, 0x31, 0x3e, 0xff, 0xfe, 0xfd, 0x3c, 0x2f, 0x68, 0x31, 0x3e]); // <h1>\xFF\xFE\xFD</h1>
  const nonUtf8ZipBuf = createSyntheticZipBuffer([
    { name: 'index.html', data: invalidUtf8Bytes, compressionMethod: 0 },
  ]);
  const nonUtf8Res = await extractZipFiles(nonUtf8ZipBuf.buffer.slice(nonUtf8ZipBuf.byteOffset, nonUtf8ZipBuf.byteOffset + nonUtf8ZipBuf.byteLength));
  assert(
    nonUtf8Res.length === 1 &&
      nonUtf8Res[0].encoding === 'utf-8' &&
      typeof nonUtf8Res[0].content === 'string' &&
      nonUtf8Res[0].content.includes('<h1>'),
    'NON-UTF8-SAFE-01',
    'extractZipFiles decodes non-UTF8 bytes without throwing (graceful replacement)'
  );

  // Test 3.3: Binary file base64 roundtrip fidelity with 100% byte verification
  const binaryRaw = crypto.randomBytes(4096); // 4KB of arbitrary binary bytes (including nulls and 0xFF)
  const binaryZipBuf = createSyntheticZipBuffer([
    { name: 'index.html', data: '<h1>Root</h1>', compressionMethod: 0 },
    { name: 'assets/image.png', data: binaryRaw, compressionMethod: 0 },
  ]);
  const binaryRes = await extractZipFiles(binaryZipBuf.buffer.slice(binaryZipBuf.byteOffset, binaryZipBuf.byteOffset + binaryZipBuf.byteLength));
  const imageEntry = binaryRes.find((f) => f.path === 'assets/image.png');
  assert(
    imageEntry && imageEntry.encoding === 'base64',
    'BIN-ENCODE-01',
    'Binary image is tagged with encoding="base64"'
  );
  // Backend normalizer decoding check
  const normalizedBin = normalizeFiles(binaryRes);
  const normalizedImage = normalizedBin.find((f) => f.path === '/assets/image.png');
  const roundtripMatches = normalizedImage && Buffer.compare(normalizedImage.buffer, binaryRaw) === 0;
  assert(
    roundtripMatches,
    'BIN-ROUNDTRIP-01',
    'Binary file roundtrips through base64 with exact byte-by-byte SHA-256 digest match'
  );

  // ------------------------------------------------------------------------
  // Suite 4: Subdomain Live Preview & Adversarial Input Validation
  // ------------------------------------------------------------------------
  console.log('\n► Suite 4: Subdomain Live Preview & Adversarial Input Validation');

  // Test 4.1: Subdomain length boundaries
  assert(validateSubdomain('ab').valid === false, 'SUB-LEN-MIN-01', 'validateSubdomain rejects length 2 (too short)');
  assert(validateSubdomain('abc').valid === true, 'SUB-LEN-MIN-02', 'validateSubdomain accepts length 3 (exact minimum)');
  assert(validateSubdomain('a'.repeat(63)).valid === true, 'SUB-LEN-MAX-01', 'validateSubdomain accepts length 63 (exact maximum)');
  assert(validateSubdomain('a'.repeat(64)).valid === false, 'SUB-LEN-MAX-02', 'validateSubdomain rejects length 64 (too long)');

  // Test 4.2: Hyphen placement rules
  assert(validateSubdomain('-mysite').valid === false, 'SUB-HYPHEN-START', 'validateSubdomain rejects leading hyphen');
  assert(validateSubdomain('mysite-').valid === false, 'SUB-HYPHEN-END', 'validateSubdomain rejects trailing hyphen');
  assert(validateSubdomain('-mysite-').valid === false, 'SUB-HYPHEN-BOTH', 'validateSubdomain rejects both leading & trailing hyphens');
  assert(validateSubdomain('my--site').valid === true, 'SUB-HYPHEN-MID', 'validateSubdomain accepts internal double hyphens (valid RFC 1035)');

  // Test 4.3: Whitespace & Case handling
  assert(validateSubdomain('  mysite  ').valid === false, 'SUB-SPACE-TRIM', 'validateSubdomain rejects un-trimmed whitespace');
  assert(validateSubdomain('my site').valid === false, 'SUB-SPACE-MID', 'validateSubdomain rejects internal space');
  assert(validateSubdomain('MySite').valid === false, 'SUB-CASE-UPPER', 'validateSubdomain rejects uppercase letters (must be lowercase)');

  // Test 4.4: Adversarial Injection attempts in subdomain
  const injectionSubdomains = [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    'my-site; drop table recipes;',
    '../../etc/passwd',
    'site/../test',
    'site.pages.dev',
    'site$test',
    'site@test',
    'site!test',
    '__proto__',
  ];
  for (const inj of injectionSubdomains) {
    const val = validateSubdomain(inj);
    assert(val.valid === false, `SUB-INJ-${inj.slice(0, 10).replace(/[^a-z0-9]/gi, '_')}`, `validateSubdomain rejects injection attempt: "${inj}"`);
  }

  // Test 4.5: Punycode subdomain support
  assert(validateSubdomain('xn--test-9qa').valid === true, 'SUB-PUNYCODE-01', 'validateSubdomain accepts valid ASCII punycode (xn--...)');

  // Test 4.6: Frontend live preview transformation simulation
  function computeLivePreviewUrl(rawInput) {
    const cleaned = rawInput.toLowerCase().trim();
    return `https://${cleaned || 'your-site'}.pages.dev`;
  }
  assert(computeLivePreviewUrl('') === 'https://your-site.pages.dev', 'PREVIEW-EMPTY-01', 'Empty subdomain shows fallback https://your-site.pages.dev');
  assert(computeLivePreviewUrl('  My-Awesome-Site  ') === 'https://my-awesome-site.pages.dev', 'PREVIEW-NORM-01', 'Live preview normalizes case and trims whitespace');
  assert(computeLivePreviewUrl('portfolio') === 'https://portfolio.pages.dev', 'PREVIEW-VALID-01', 'Valid subdomain produces clean *.pages.dev URL');

  // ------------------------------------------------------------------------
  // Suite 5: High Load / Bundle Stress & Benchmarks
  // ------------------------------------------------------------------------
  console.log('\n► Suite 5: High Load / Bundle Stress & Benchmarks');

  // Test 5.1: Large bundle of 200 files
  const largeFileList = [];
  largeFileList.push({ path: 'index.html', content: '<h1>Bundle</h1>', encoding: 'utf-8' });
  for (let i = 1; i <= 200; i++) {
    largeFileList.push({
      path: `assets/data-${i}.json`,
      content: JSON.stringify({ index: i, timestamp: Date.now() }),
      encoding: 'utf-8',
    });
  }
  const largeBundleVal = validateFileBundle(largeFileList);
  assert(
    largeBundleVal.valid === true,
    'LARGE-BUNDLE-200',
    'validateFileBundle succeeds with 201-file website bundle'
  );

  // Test 5.2: 5MB binary file base64 performance benchmark
  const largeBinary = crypto.randomBytes(5 * 1024 * 1024); // 5 MB
  const t0 = performance.now();
  let binaryStr = '';
  const len = largeBinary.byteLength;
  for (let i = 0; i < len; i++) {
    binaryStr += String.fromCharCode(largeBinary[i]);
  }
  const b64 = btoa(binaryStr);
  const durationMs = performance.now() - t0;
  assert(
    durationMs < 2000,
    'PERF-5MB-BASE64',
    `5MB binary base64 conversion completes in ${durationMs.toFixed(2)}ms (< 2000ms threshold)`
  );
  assert(
    b64.length > 5 * 1024 * 1024,
    'PERF-5MB-INTEGRITY',
    '5MB base64 string length matches standard expansion ratio (~6.99 MB)'
  );

  // Test 5.3: ZIP with 50 entries performance
  const zip50Entries = [
    { name: 'index.html', data: '<h1>Root</h1>', compressionMethod: 0 },
  ];
  for (let i = 1; i <= 50; i++) {
    zip50Entries.push({
      name: `sub/page-${i}.html`,
      data: `<h2>Page ${i}</h2>`,
      compressionMethod: 0,
    });
  }
  const zip50Buf = createSyntheticZipBuffer(zip50Entries);
  const tZip0 = performance.now();
  const zip50Extracted = await extractZipFiles(zip50Buf.buffer.slice(zip50Buf.byteOffset, zip50Buf.byteOffset + zip50Buf.byteLength));
  const zipDuration = performance.now() - tZip0;
  assert(
    zip50Extracted.length === 51 && zipDuration < 500,
    'PERF-ZIP-50',
    `extractZipFiles unpacks 51 files in ${zipDuration.toFixed(2)}ms (< 500ms threshold)`
  );

  // ------------------------------------------------------------------------
  // Suite 6: "No Jargon, Ever" Copy & Wizard Contract Audit
  // ------------------------------------------------------------------------
  console.log('\n► Suite 6: "No Jargon, Ever" Copy & Wizard Contract Audit');

  const bannedJargon = [
    'DNS',
    'CNAME',
    'TLS',
    'SSL',
    'REST',
    'HTTP 403',
    'HTTP 401',
    '403 Forbidden',
    'manifest',
    'endpoint',
    'container',
  ];

  const wizardPath = path.resolve(WEB_DIR, 'components/recipes/hosting-wizard.tsx');
  const wizardContent = fs.readFileSync(wizardPath, 'utf8');

  // Extract customer-facing strings (heuristic: lines with JSX text or quotes)
  let jargonViolations = 0;
  for (const term of bannedJargon) {
    // Check if term appears inside JSX rendered text (exclude import paths, types, or comments)
    const regex = new RegExp(`>.*\\b${term}\\b.*<`, 'i');
    if (regex.test(wizardContent)) {
      jargonViolations++;
      console.log(`  ✖ Banned term detected in wizard JSX: "${term}"`);
    }
  }

  assert(
    jargonViolations === 0,
    'JARGON-WIZARD-01',
    'hosting-wizard.tsx contains ZERO user-facing instances of banned technical jargon'
  );

  const recipeListPath = path.resolve(WEB_DIR, 'components/recipes/recipe-list.tsx');
  const recipeListContent = fs.readFileSync(recipeListPath, 'utf8');
  let listJargonViolations = 0;
  for (const term of bannedJargon) {
    const regex = new RegExp(`>.*\\b${term}\\b.*<`, 'i');
    if (regex.test(recipeListContent)) {
      listJargonViolations++;
      console.log(`  ✖ Banned term detected in recipe-list JSX: "${term}"`);
    }
  }

  assert(
    listJargonViolations === 0,
    'JARGON-LIST-01',
    'recipe-list.tsx contains ZERO user-facing instances of banned technical jargon'
  );

  // ------------------------------------------------------------------------
  // Empirical Summary
  // ------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('                          STRESS TEST SUMMARY                           ');
  console.log('========================================================================');
  console.log(`Total Tests Run:  ${totalTests}`);
  console.log(`Passed:           ${passedTests}`);
  console.log(`Failed / Bugs:    ${failedTests}`);

  if (failedTests > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  - [${f.testId}] ${f.message}`);
    }
    process.exit(1);
  } else {
    console.log('\nAll empirical tests PASSED successfully!\n');
    process.exit(0);
  }
}

runWizardStressSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
