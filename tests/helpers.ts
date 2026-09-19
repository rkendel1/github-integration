import { randomUUID } from 'node:crypto';
import type { AuthProjection } from '@authboundry/core';
import { createStaticAuthority } from '../src/auth.js';
import { createGitHubIntegrationState } from '../src/state.js';
import type { GitHubConnection, GitHubTransport } from '../src/types.js';

export function fixtureAuth(capabilities: string[]): AuthProjection {
  return {
    authenticated: true,
    principal: { id: 'principal:alice', kind: 'user' },
    tenant: { id: 'tenant:acme' },
    claims: {},
    capabilities,
    session: null,
    delegation: null,
  };
}

export function fixtureConnection(): GitHubConnection {
  const now = new Date().toISOString();
  return {
    id: 'connection-1',
    tenantId: 'tenant:acme',
    applicationId: 'github.integration',
    environment: 'test',
    provider: 'github',
    credentialReference: { secretId: 'secret-1', tenantId: 'tenant:acme', provider: 'github' },
    webhookSecretReference: { secretId: 'webhook-1', tenantId: 'tenant:acme', provider: 'github' },
    authMechanism: 'personal_access_token',
    status: 'configured',
    accountLogin: 'acme-app',
    accountType: 'Organization',
    capabilities: ['github.repository.read', 'github.issue.create'],
    createdAt: now,
    updatedAt: now,
  };
}

export function fixtureTransport(): GitHubTransport {
  return {
    organizations: {
      async list() { return [{ login: 'acme', id: 1 }]; },
      async get() { return { login: 'acme', id: 1 }; },
    },
    repositories: {
      async list() { return [{ id: 1, owner: 'acme', name: 'repo', fullName: 'acme/repo', private: false, archived: false }]; },
      async get() { return { id: 1, owner: 'acme', name: 'repo', fullName: 'acme/repo', private: false, archived: false, defaultBranch: 'main' }; },
    },
    branches: {
      async list() { return [{ name: 'main', sha: 'abc', protected: true }]; },
      async get() { return { name: 'main', sha: 'abc', protected: true }; },
      async create(_connection, _context, input) { return { name: input.branch, sha: input.fromSha, protected: false }; },
    },
    commits: {
      async list() { return [{ sha: 'abc', message: 'initial' }]; },
      async get() { return { sha: 'abc', message: 'initial' }; },
    },
    issues: {
      async list() { return [{ number: 1, title: 'bug', state: 'open' }]; },
      async get() { return { number: 1, title: 'bug', state: 'open' }; },
      async create() { return { number: 2, title: 'created', state: 'open' }; },
      async update() { return { number: 2, title: 'updated', state: 'open' }; },
      async comment() { return { id: 2, body: 'ok' }; },
    },
    pullRequests: {
      async list() { return [{ number: 1, title: 'pr', state: 'open' }]; },
      async get() { return { number: 1, title: 'pr', state: 'open' }; },
      async create() { return { number: 3, title: 'created', state: 'open' }; },
      async update() { return { number: 3, title: 'updated', state: 'open' }; },
      async comment() { return { id: 3, body: 'ok' }; },
      async review() { return { id: 3, state: 'APPROVED' }; },
      async merge() { return { merged: true, sha: 'def' }; },
    },
  };
}

export function createTestHarness(capabilities: string[]) {
  return {
    authority: createStaticAuthority(fixtureAuth(capabilities)),
    state: createGitHubIntegrationState({ memory: true, namespace: `github-integration-tests-${randomUUID()}` }),
    transport: fixtureTransport(),
  };
}
