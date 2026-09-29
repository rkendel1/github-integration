import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubIntegrationForTesting, GitHubCapabilityError } from '../src/integration.js';
import { createTestHarness, fixtureConnection, fixtureTransport } from './helpers.js';

const invocation = { applicationId: 'source-consumer' };

function statusError(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

test('requested ref is preserved and resolves deterministically to an immutable commit', async () => {
  const harness = createTestHarness(['github.repository.read']);
  const refs: string[] = [];
  const transport = fixtureTransport();
  transport.commits.get = async (_connection, _context, input) => {
    refs.push(input.sha);
    return { sha: '0123456789abcdef0123456789abcdef01234567', message: 'resolved' };
  };
  const integration = createGitHubIntegrationForTesting({ ...harness, transport, resolveWebhookSecret: async () => 'secret' });
  await integration.upsertConnection(fixtureConnection());

  const first = await integration.repositories.source({ connectionId: 'connection-1', owner: 'acme', repository: 'repo', ref: 'release/v1' }, invocation);
  const second = await integration.repositories.source({ connectionId: 'connection-1', owner: 'acme', repository: 'repo', ref: 'release/v1' }, invocation);

  assert.equal(first.source, 'git');
  assert.match(first.url, /\.git$/);
  assert.equal(first.ref, 'release/v1');
  assert.equal(first.commit, '0123456789abcdef0123456789abcdef01234567');
  assert.deepEqual(second, first);
  assert.deepEqual(refs, ['release/v1', 'release/v1']);
  assert.equal('provider' in first, false);
  assert.equal('credentialReference' in first, false);
  const durableState = JSON.stringify({
    repositories: await harness.state.repositories.list(),
    operations: await harness.state.operations.list(),
    evidence: await harness.state.evidence.list(),
  });
  assert.doesNotMatch(durableState, /release\/v1/);
});

test('invalid repository and ref fail before provider execution', async () => {
  const harness = createTestHarness(['github.repository.read']);
  const transport = fixtureTransport();
  let providerCalls = 0;
  transport.repositories.get = async () => {
    providerCalls += 1;
    return { id: 1, owner: 'acme', name: 'repo', fullName: 'acme/repo', private: false, archived: false, defaultBranch: 'main' };
  };
  const integration = createGitHubIntegrationForTesting({ ...harness, transport, resolveWebhookSecret: async () => 'secret' });
  await integration.upsertConnection(fixtureConnection());

  await assert.rejects(
    integration.repositories.source({ connectionId: 'connection-1', owner: 'bad owner', repository: 'repo' }, invocation),
    (error: unknown) => error instanceof GitHubCapabilityError && error.code === 'INVALID_INPUT',
  );
  await assert.rejects(
    integration.repositories.source({ connectionId: 'connection-1', owner: 'acme', repository: 'repo', ref: '../secret' }, invocation),
    (error: unknown) => error instanceof GitHubCapabilityError && error.code === 'INVALID_INPUT',
  );
  assert.equal(providerCalls, 0);
});

test('repository not found and invalid ref are structured capability failures', async () => {
  const missingHarness = createTestHarness(['github.repository.read']);
  const missingTransport = fixtureTransport();
  missingTransport.repositories.get = async () => { throw statusError(404, 'provider route not found'); };
  const missing = createGitHubIntegrationForTesting({ ...missingHarness, transport: missingTransport, resolveWebhookSecret: async () => 'secret' });
  await missing.upsertConnection(fixtureConnection());
  await assert.rejects(
    missing.repositories.source({ connectionId: 'connection-1', owner: 'acme', repository: 'missing' }, invocation),
    (error: unknown) => error instanceof GitHubCapabilityError && error.code === 'REPOSITORY_NOT_FOUND' && error.operation === 'github.repository.read',
  );

  const refHarness = createTestHarness(['github.repository.read']);
  const refTransport = fixtureTransport();
  refTransport.commits.get = async () => { throw statusError(404, 'bad ref'); };
  const invalidRef = createGitHubIntegrationForTesting({ ...refHarness, transport: refTransport, resolveWebhookSecret: async () => 'secret' });
  await invalidRef.upsertConnection(fixtureConnection());
  await assert.rejects(
    invalidRef.repositories.source({ connectionId: 'connection-1', owner: 'acme', repository: 'repo', ref: 'missing-ref' }, invocation),
    (error: unknown) => error instanceof GitHubCapabilityError && error.code === 'REF_NOT_FOUND' && error.context.ref === 'missing-ref',
  );
});

test('authentication and provider failures are sanitized and never return partial sources', async () => {
  const authHarness = createTestHarness(['github.repository.read']);
  const authTransport = fixtureTransport();
  authTransport.repositories.get = async () => { throw new Error('Missing GitHub token resolver.'); };
  const auth = createGitHubIntegrationForTesting({ ...authHarness, transport: authTransport, resolveWebhookSecret: async () => 'secret' });
  await auth.upsertConnection(fixtureConnection());
  await assert.rejects(
    auth.repositories.source({ connectionId: 'connection-1', owner: 'acme', repository: 'repo' }, invocation),
    (error: unknown) => error instanceof GitHubCapabilityError && error.code === 'AUTHENTICATION_UNAVAILABLE' && !error.message.includes('token'),
  );

  const providerHarness = createTestHarness(['github.repository.read']);
  const providerTransport = fixtureTransport();
  providerTransport.commits.get = async () => { throw new Error('Authorization: Bearer ghp_super_secret private_key=bad'); };
  const provider = createGitHubIntegrationForTesting({ ...providerHarness, transport: providerTransport, resolveWebhookSecret: async () => 'secret' });
  await provider.upsertConnection(fixtureConnection());
  await assert.rejects(
    provider.repositories.source({ connectionId: 'connection-1', owner: 'acme', repository: 'repo' }, invocation),
    (error: unknown) => error instanceof GitHubCapabilityError && error.code === 'PROVIDER_FAILURE' && !/ghp_|bearer|private_key/i.test(error.message),
  );
  const operations = await providerHarness.state.operations.list();
  assert.equal(operations.at(-1)?.status, 'failed');
  assert.doesNotMatch(operations.at(-1)?.error ?? '', /ghp_|bearer|private_key/i);
});
