import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticAuthority } from '../src/auth.js';
import { createGitHubIntegrationForTesting } from '../src/integration.js';
import { createOctokitTransport } from '../src/octokit.js';
import { createGitHubIntegrationState } from '../src/state.js';
import { fixtureAuth } from './helpers.js';

test('public repository resolves through AppPort into a provider-neutral Git source', {
  skip: process.env.GITHUB_PUBLIC_E2E !== 'true' ? 'set GITHUB_PUBLIC_E2E=true for the release verification' : false,
}, async () => {
  const integration = createGitHubIntegrationForTesting({
    authority: createStaticAuthority(fixtureAuth(['github.repository.read'])),
    state: createGitHubIntegrationState({ memory: true, namespace: 'github-public-release-e2e' }),
    transport: createOctokitTransport(async () => { throw new Error('public access must not resolve a credential'); }),
    resolveWebhookSecret: async () => 'unused',
  });
  const now = new Date().toISOString();
  await integration.upsertConnection({
    id: 'public-github', tenantId: 'tenant:acme', applicationId: 'source-consumer', environment: 'release',
    provider: 'github', authMechanism: 'public', status: 'configured', createdAt: now, updatedAt: now,
  });

  const source = await integration.repositories.source(
    { connectionId: 'public-github', owner: 'rkendel1', repository: 'github-integration', ref: 'main' },
    { applicationId: 'source-consumer' },
  );

  assert.deepEqual({ source: source.source, owner: source.owner, repository: source.repository, ref: source.ref }, {
    source: 'git', owner: 'rkendel1', repository: 'github-integration', ref: 'main',
  });
  assert.equal(source.url, 'https://github.com/rkendel1/github-integration.git');
  assert.match(source.commit, /^[0-9a-f]{40}$/);
  assert.equal('provider' in source, false);
  assert.equal('credentialReference' in source, false);
});
