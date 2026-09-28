import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { runArchitectureAudit } from '../src/architecture-audit.js';
import { capabilityNames } from '../src/capabilities.js';

const root = process.cwd();
const escapeRegExp = (value: string) => value.split('\\').join('\\\\').split('.').join('\\.');

test('architecture audit invariants pass', async () => {
  const audit = await runArchitectureAudit(root);
  assert.equal(audit.noSecondDurableDatabase, true);
  assert.equal(audit.noConsumerDependencies, true);
  assert.equal(audit.noSecretStoreDependency, true);
  assert.equal(audit.uiActionsMapToCapabilities, true);
  assert.equal(audit.allMutationsAuthorized, true);
  assert.equal(audit.allMutationsGenerateEvidence, true);
});

test('feltdb.flow declares canonical github capabilities', async () => {
  const flow = await readFile(path.join(root, 'feltdb.flow'), 'utf8');
  for (const capability of capabilityNames) {
    assert.match(flow, new RegExp(escapeRegExp(capability)));
  }
});

test('feltdb.flow is valid FlowSpec according to the pinned @feltdb/core grammar', async () => {
  const feltdbBinary = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'feltdb.cmd' : 'feltdb');
  const result = spawnSync(feltdbBinary, ['validate', path.join(root, 'feltdb.flow')], { encoding: 'utf8' });
  assert.equal(result.status, 0, `feltdb validate failed:\n${result.stdout}\n${result.stderr}`);
  assert.doesNotMatch(result.stdout + result.stderr, /Error:/);
});

test('public api barrel does not export octokit implementation details', async () => {
  const indexSource = await readFile(path.join(root, 'src', 'index.ts'), 'utf8');
  assert.doesNotMatch(indexSource, /Octokit/);
});
