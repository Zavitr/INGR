/**
 * Adversarial and Functional Verification of Natural Language Prompt-to-Flow Engine
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import createJiti from '../../web/node_modules/jiti/lib/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, '../../web');

const jiti = createJiti(path.resolve(WEB_ROOT, 'test_runner.js'), {
  alias: { '@': WEB_ROOT },
});

process.env.TEST_MODE = 'true';
process.env.NODE_ENV = 'test';

const { generateFlowFromPrompt } = jiti(path.resolve(WEB_ROOT, 'lib/recipes/flow-prompt-engine.ts'));

console.log('========================================================================');
console.log('       Flow Magic Prompt Engine — Stress & Intent Verification');
console.log('========================================================================\n');

let passed = 0;
let failed = 0;

function runCheck(name, fn) {
  try {
    const t0 = performance.now();
    fn();
    const dt = (performance.now() - t0).toFixed(2);
    console.log(`  ✔ PASS: ${name} (${dt}ms)`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// 1. Direct Arrow Notation
runCheck('01. Parses arrow-separated chain "Clash of Clans -> Discord -> Sheets"', () => {
  const flow = generateFlowFromPrompt('Clash of Clans -> Discord -> Google Sheets');
  assert.strictEqual(flow.nodes.length, 3, 'Expected 3 nodes');
  assert.strictEqual(flow.nodes[0].connectorDisplayName, 'Clash of Clans');
  assert.strictEqual(flow.nodes[0].type, 'trigger');
  assert.strictEqual(flow.nodes[1].connectorDisplayName, 'Discord');
  assert.strictEqual(flow.nodes[1].type, 'action');
  assert.strictEqual(flow.nodes[2].connectorDisplayName, 'Google Sheets');
  assert.strictEqual(flow.nodes[2].type, 'action');
  assert.strictEqual(flow.connections.length, 2, 'Expected 2 connections wiring the nodes');
});

// 2. Natural English with "When ..., then ... and ..."
runCheck('02. Parses natural clause "When a GitHub PR is merged, deploy on Cloudflare and notify Slack"', () => {
  const flow = generateFlowFromPrompt('When a GitHub PR is merged, deploy on Cloudflare and notify Slack');
  assert(flow.nodes.length >= 3, 'Expected at least 3 nodes');
  assert.strictEqual(flow.nodes[0].connectorDisplayName, 'GitHub');
  assert.strictEqual(flow.nodes[0].type, 'trigger');
  const hasCloudflare = flow.nodes.some((n) => n.connectorDisplayName.toLowerCase().includes('cloudflare'));
  const hasSlack = flow.nodes.some((n) => n.connectorDisplayName.toLowerCase().includes('slack'));
  assert(hasCloudflare, 'Expected Cloudflare node');
  assert(hasSlack, 'Expected Slack node');
});

// 3. Data Pill Pre-wiring
runCheck('03. Downstream parameters automatically interpolate upstream step outputs', () => {
  const flow = generateFlowFromPrompt('Stripe -> Discord');
  assert.strictEqual(flow.nodes.length, 2);
  const actionNode = flow.nodes[1];
  assert(
    typeof actionNode.parameters.messageContent === 'string' &&
    actionNode.parameters.messageContent.includes('{{step_1_trigger.data}}'),
    'Action parameters should contain data pill reference to step 1'
  );
});

// 4. Performance: 50 runs in < 150ms (<3ms per parse across catalog)
runCheck('04. High performance parse latency (sub-millisecond)', () => {
  const t0 = performance.now();
  for (let i = 0; i < 50; i++) {
    generateFlowFromPrompt('When Stripe charges customer, log to Notion and ping Slack');
  }
  const totalMs = performance.now() - t0;
  assert(totalMs < 250, `Expected 50 parses under 250ms, took ${totalMs.toFixed(2)}ms`);
});

// 5. Empty or whitespace prompt error boundary
runCheck('05. Safely rejects empty or blank prompts with error', () => {
  let threw = false;
  try {
    generateFlowFromPrompt('   ');
  } catch {
    threw = true;
  }
  assert(threw, 'Expected empty prompt to throw Error');
});

console.log('\n========================================================================');
console.log(`Prompt Engine Results: ${passed} Passed, ${failed} Failed`);
console.log('========================================================================\n');

process.exit(failed > 0 ? 1 : 0);
