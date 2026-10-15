/**
 * E2E Test Suite Context & Configuration
 * Provides environment settings, root directory pointers, and test harness registry.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROJECT_ROOT = path.resolve(__dirname, '../../..');
export const ENGINE_ROOT = path.resolve(PROJECT_ROOT, 'engine');
export const WEB_ROOT = path.resolve(PROJECT_ROOT, 'web');

export const CONFIG = {
  engineUrl: process.env.ACTIVEPIECES_API_URL || 'http://localhost:8080',
  webUrl: process.env.WEB_URL || 'http://localhost:3000',
  adminEmail: process.env.AP_ADMIN_EMAIL || 'admin@ingr.local',
  adminPassword: process.env.AP_ADMIN_PASSWORD || 'IngrAdminPassword2026!',
  expectedProjectId: 'p9e5uqp6AvNwbWpreGMRy',
};

class TestRegistry {
  constructor() {
    this.results = [];
    this.currentSuite = null;
    this.currentTier = null;
    this.currentFeature = null;
  }

  setSuite(name, tier, feature) {
    this.currentSuite = name;
    this.currentTier = tier;
    this.currentFeature = feature;
  }

  async runTest(testName, fn) {
    const startTime = Date.now();
    const testRecord = {
      name: testName,
      suite: this.currentSuite,
      tier: this.currentTier,
      feature: this.currentFeature,
      status: 'PASS',
      error: null,
      durationMs: 0,
    };

    try {
      await fn();
      testRecord.status = 'PASS';
    } catch (err) {
      testRecord.status = 'FAIL';
      testRecord.error = err.message || String(err);
      if (err.stack) {
        testRecord.stack = err.stack;
      }
    } finally {
      testRecord.durationMs = Date.now() - startTime;
      this.results.push(testRecord);
    }

    return testRecord;
  }

  clear() {
    this.results = [];
  }

  getSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    return { total, passed, failed, results: this.results };
  }
}

export const registry = new TestRegistry();
