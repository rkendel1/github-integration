import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { runArchitectureAudit } from '../src/architecture-audit.js';
import { capabilityNames } from '../src/capabilities.js';

const root = process.cwd();

test('architecture audit invariants pass', async () => {
  const audit = await runArchitectureAudit(root);
  assert.equal(audit.noSecondDurableDatabase, true);
  assert.equal(audit.noConsumerDependencies, true);
  assert.equal(audit.uiActionsMapToCapabilities, true);
  assert.equal(audit.allMutationsAuthorized, true);
  assert.equal(audit.allMutationsGenerateEvidence, true);
});

const escapeRegExp = (value: string) => value.split('\\').join('\\\\').split('.').join('\\.');

test('.flow declares canonical github capabilities', async () => {
  const flow = await readFile(path.join(root, '.flow'), 'utf8');
  for (const capability of capabilityNames) {
    assert.match(flow, new RegExp(escapeRegExp(capability)));
  }
});

test('public api barrel does not export octokit implementation details', async () => {
  const indexSource = await readFile(path.join(root, 'src', 'index.ts'), 'utf8');
  assert.doesNotMatch(indexSource, /Octokit/);
});
