/**
 * Custom Assertion Library for E2E Tests
 */

import fs from 'node:fs';

export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEqual(actual, expected, message) {
  const msg = message || `Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`;
  if (actual !== expected) {
    throw new Error(msg);
  }
}

export function assertNotEqual(actual, expected, message) {
  const msg = message || `Expected ${JSON.stringify(actual)} not to equal ${JSON.stringify(expected)}`;
  if (actual === expected) {
    throw new Error(msg);
  }
}

export function assertIncludes(haystack, needle, message) {
  const msg = message || `Expected "${haystack}" to include "${needle}"`;
  if (typeof haystack === 'string' && !haystack.includes(needle)) {
    throw new Error(msg);
  } else if (Array.isArray(haystack) && !haystack.includes(needle)) {
    throw new Error(msg);
  } else if (haystack === null || haystack === undefined) {
    throw new Error(msg || 'Target is null or undefined');
  }
}

export function assertNotIncludes(haystack, needle, message) {
  const msg = message || `Expected "${haystack}" NOT to include "${needle}"`;
  if (typeof haystack === 'string' && haystack.includes(needle)) {
    throw new Error(msg);
  } else if (Array.isArray(haystack) && haystack.includes(needle)) {
    throw new Error(msg);
  }
}

export function assertMatch(str, regex, message) {
  const msg = message || `Expected "${str}" to match ${regex}`;
  if (!regex.test(str)) {
    throw new Error(msg);
  }
}

export function assertHttpStatus(status, expectedStatus, message) {
  const msg = message || `Expected HTTP status ${expectedStatus}, received ${status}`;
  if (status !== expectedStatus) {
    throw new Error(msg);
  }
}

export function assertFileExists(filePath, message) {
  const msg = message || `Expected file to exist at: ${filePath}`;
  if (!fs.existsSync(filePath)) {
    throw new Error(msg);
  }
}

export function assertFileContains(filePath, needle, message) {
  assertFileExists(filePath, message);
  const content = fs.readFileSync(filePath, 'utf-8');
  assertIncludes(content, needle, message || `Expected file ${filePath} to contain "${needle}"`);
}

export function assertFileNotContains(filePath, needle, message) {
  assertFileExists(filePath, message);
  const content = fs.readFileSync(filePath, 'utf-8');
  assertNotIncludes(content, needle, message || `Expected file ${filePath} NOT to contain "${needle}"`);
}
