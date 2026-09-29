import test from 'node:test';
import assert from 'node:assert/strict';
import { githubAppPortManifest } from '../src/capabilities.js';
import { parseGitHubCapabilityDeclaration } from '../src/dsl.js';

test('standard AppPort use syntax declares GitHub as a first-class capability', () => {
  const declaration = parseGitHubCapabilityDeclaration(`
version = "1"

[application]
name = "source-consumer"

use github {
  repositories = true
  webhooks = true
}
`);

  assert.equal(declaration.service, 'github');
  assert.equal(declaration.syntax, 'use github');
  assert.deepEqual(declaration.groups, ['repositories', 'webhooks']);
  assert.deepEqual(declaration.operations, [
    'github.repository.read',
    'github.branch.read',
    'github.branch.create',
    'github.commit.read',
  ]);
});

test('plain use github selects the implemented capability groups', () => {
  const declaration = parseGitHubCapabilityDeclaration('use github\n');
  assert.deepEqual(declaration.groups, ['organizations', 'repositories', 'webhooks', 'pull_requests', 'issues']);
  assert.ok(declaration.operations.includes('github.repository.read'));
  assert.ok(declaration.operations.includes('github.pull_request.merge'));
  assert.ok(declaration.operations.includes('github.issue.create'));
});

test('GitHub DSL accepts intent only and rejects credentials or ad-hoc syntax', () => {
  assert.throws(
    () => parseGitHubCapabilityDeclaration('use github {\n  token = true\n}\n'),
    /invalid GitHub capability/,
  );
  assert.throws(
    () => parseGitHubCapabilityDeclaration('use github repositories\n'),
    /use "use github" or an AppPort capability block/,
  );
});

test('AppPort manifest is derived from semantic operations and declares existing boundaries', () => {
  assert.equal(githubAppPortManifest.protocol, 'AppPort/1');
  assert.equal(githubAppPortManifest.application.id, 'github');
  assert.equal(githubAppPortManifest.metadata?.declaration, 'use github');
  assert.equal(githubAppPortManifest.metadata?.credentialBoundary, '@appport/services');
  assert.deepEqual(githubAppPortManifest.metadata?.authentication, {
    publicRepositoryAccess: 'credential-free',
    authenticatedAccess: 'credential-reference',
    mechanisms: ['github_app', 'oauth_token', 'personal_access_token'],
  });
  assert.equal(githubAppPortManifest.metadata?.persistenceAuthority, 'feltdb');
  assert.equal(githubAppPortManifest.metadata?.persistenceContract, 'feltdb.flow');
  assert.ok(githubAppPortManifest.provides.some((capability) => capability.name === 'github.repository.read'));
  assert.ok(githubAppPortManifest.provides.every((capability) => /^github\.[a-z_]+\.[a-z_]+$/.test(capability.name)));
  assert.doesNotMatch(JSON.stringify(githubAppPortManifest), /npm_[a-z0-9]+|ghp_[a-z0-9]+|bearer\s+|secretId|\/repos\//i);
});
