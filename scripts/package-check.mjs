import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  }
  return result;
}

const root = process.cwd();
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'github-integration-package-'));
const npmEnvironment = { ...process.env, npm_config_cache: path.join(temporaryRoot, 'npm-cache') };
try {
  const pack = run('npm', ['pack', '--json', '--pack-destination', temporaryRoot], { cwd: root, capture: true, env: npmEnvironment });
  const [manifest] = JSON.parse(pack.stdout);
  assert.equal(manifest.name, '@rkendel1/github-integration');
  assert.equal(manifest.version, '1.0.1');
  const included = new Set(manifest.files.map((file) => file.path));
  for (const required of ['package.json', '.flow', 'README.md', 'docs/package.md', 'docs/consumer.md', 'dist/src/index.js', 'dist/src/index.d.ts']) {
    assert.ok(included.has(required), `package is missing ${required}`);
  }
  assert.ok([...included].every((file) => !file.startsWith('tests/') && !file.startsWith('src/') && !file.startsWith('scripts/')));

  const publicDeclaration = await readFile(path.join(root, 'dist/src/index.d.ts'), 'utf8');
  assert.doesNotMatch(publicDeclaration, /Octokit|RequestError|@octokit|GitHubTransport|transport\.js/);

  await run('npm', ['init', '--yes'], { cwd: temporaryRoot, capture: true, env: npmEnvironment });
  await run('npm', ['install', '--ignore-scripts', '--package-lock=false', path.join(temporaryRoot, manifest.filename)], { cwd: temporaryRoot, env: npmEnvironment });
  for (const developmentOnly of ['typescript', '@types/node']) {
    await assert.rejects(access(path.join(temporaryRoot, 'node_modules', developmentOnly)), undefined, `${developmentOnly} leaked into the runtime install`);
  }

  await writeFile(path.join(temporaryRoot, 'consumer.mjs'), `
import { createGitHubIntegration } from '@rkendel1/github-integration';
const authority = {
  async session() { return { authenticated: true, principal: { id: 'principal:test', kind: 'user' }, tenant: { id: 'tenant:test' }, claims: {}, capabilities: [], session: null, delegation: null }; },
  async authorize() { return false; },
};
const github = createGitHubIntegration({ authority, felt: { memory: true, namespace: 'clean-consumer' } });
const now = new Date().toISOString();
await github.upsertConnection({ id: 'connection-1', tenantId: 'tenant:test', applicationId: 'consumer', environment: 'test', provider: 'github', credentialReference: { secretId: 'secret-1', tenantId: 'tenant:test', provider: 'github' }, authMechanism: 'personal_access_token', status: 'configured', createdAt: now, updatedAt: now });
await github.issues.create({ connectionId: 'connection-1', owner: 'acme', repository: 'repo', title: 'test' }, { applicationId: 'consumer' }).then(() => { throw new Error('operation unexpectedly authorized'); }, (error) => { if (!String(error).includes('Authorization required')) throw error; });
if (!(await github.flow()).includes('app github_integration')) throw new Error('canonical .flow unavailable');
if (github.appBoundryContract === undefined || typeof github.webhooks.handle !== 'function') throw new Error('public contract incomplete');
`);
  await run(process.execPath, [path.join(temporaryRoot, 'consumer.mjs')], { cwd: temporaryRoot });

  await writeFile(path.join(temporaryRoot, 'consumer.ts'), `
import { createGitHubIntegration, type GitHubConnection, type MergePullRequestInput } from '@rkendel1/github-integration';
declare const connection: GitHubConnection;
const input: MergePullRequestInput = { connectionId: connection.id, owner: 'acme', repository: 'repo', pullNumber: 1, method: 'squash' };
const github = createGitHubIntegration();
void github.pullRequests.merge(input, { applicationId: 'consumer' });
`);
  run(path.join(root, 'node_modules/.bin/tsc'), ['--noEmit', '--skipLibCheck', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', path.join(temporaryRoot, 'consumer.ts')], { cwd: temporaryRoot });
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
