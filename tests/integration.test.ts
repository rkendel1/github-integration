import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createGitHubIntegrationForTesting } from '../src/integration.js';
import { createGitHubIntegrationState } from '../src/state.js';
import { fixtureConnection, createTestHarness } from './helpers.js';
import { signGitHubWebhook } from '../src/webhooks.js';

const invocation = {
  applicationId: 'github.integration',
  claimedPrincipalId: 'principal:mallory',
  claimedTenantId: 'tenant:evil',
};

test('mutations use AuthBoundry authority rather than caller-supplied identity and generate evidence', async () => {
  const harness = createTestHarness(['github.issue.create']);
  const integration = createGitHubIntegrationForTesting({ ...harness, resolveWebhookSecret: async () => 'secret' });
  await integration.upsertConnection(fixtureConnection());

  const issue = await integration.issues.create({ connectionId: 'connection-1', owner: 'acme', repository: 'repo', title: 'hello' }, invocation);
  assert.equal(issue.number, 2);

  const operations = await harness.state.operations.list();
  const evidence = await harness.state.evidence.list();

  assert.equal(operations[0]?.principalId, 'principal:alice');
  assert.equal(operations[0]?.tenantId, 'tenant:acme');
  assert.equal(evidence[0]?.principalId, 'principal:alice');
  assert.equal(evidence[0]?.tenantId, 'tenant:acme');
  assert.equal(evidence[0]?.result, 'succeeded');
});

test('authorization is required for mutations', async () => {
  const harness = createTestHarness([]);
  const integration = createGitHubIntegrationForTesting({ ...harness, resolveWebhookSecret: async () => 'secret' });
  await integration.upsertConnection(fixtureConnection());

  await assert.rejects(
    integration.pullRequests.merge({ connectionId: 'connection-1', owner: 'acme', repository: 'repo', pullNumber: 1 }, invocation),
    /Authorization required/,
  );
});

test('connection state stores references instead of secret material', async () => {
  const harness = createTestHarness(['github.repository.read']);
  const integration = createGitHubIntegrationForTesting({ ...harness, resolveWebhookSecret: async () => 'secret' });
  await integration.upsertConnection(fixtureConnection());

  const stored = await integration.getConnection('connection-1');
  assert.equal(stored?.credentialReference.secretId, 'secret-1');
  assert.equal('token' in ((stored as unknown) as Record<string, unknown>), false);
});

test('repository records are isolated by connection id', async () => {
  const harness = createTestHarness(['github.repository.read']);
  const integration = createGitHubIntegrationForTesting({ ...harness, resolveWebhookSecret: async () => 'secret' });
  await integration.upsertConnection(fixtureConnection());
  await integration.upsertConnection({ ...fixtureConnection(), id: 'connection-2' });

  await integration.repositories.get({ connectionId: 'connection-1', owner: 'acme', repository: 'repo' }, invocation);
  await integration.repositories.get({ connectionId: 'connection-2', owner: 'acme', repository: 'repo' }, invocation);

  const repositories = await harness.state.repositories.list();
  assert.equal(repositories.length, 2);
});

test('valid webhook signatures persist durable webhook state and duplicate deliveries are idempotent', async () => {
  const harness = createTestHarness(['github.issue.read']);
  const integration = createGitHubIntegrationForTesting({ ...harness, resolveWebhookSecret: async () => 'secret' });
  await integration.upsertConnection(fixtureConnection());

  const rawBody = JSON.stringify({ action: 'opened', repository: { full_name: 'acme/repo' } });
  const signature = signGitHubWebhook(rawBody, 'secret');
  const headers = {
    'x-github-delivery': 'delivery-1',
    'x-github-event': 'issues',
    'x-hub-signature-256': signature,
  };

  const first = await integration.webhooks.handle('connection-1', rawBody, headers);
  const second = await integration.webhooks.handle('connection-1', rawBody, headers);

  assert.equal(first.signatureValid, true);
  assert.equal(first.status, 'processed');
  assert.equal(second.id, first.id);

  const records = await harness.state.webhooks.list();
  assert.equal(records.length, 1);
});

test('invalid webhook signatures are rejected and cannot claim an earlier valid delivery id', async () => {
  const harness = createTestHarness(['github.issue.read']);
  const integration = createGitHubIntegrationForTesting({ ...harness, resolveWebhookSecret: async () => 'secret' });
  await integration.upsertConnection(fixtureConnection());

  const rawBody = JSON.stringify({ action: 'opened' });
  const validHeaders = {
    'x-github-delivery': 'delivery-2',
    'x-github-event': 'issues',
    'x-hub-signature-256': signGitHubWebhook(rawBody, 'secret'),
  };
  await integration.webhooks.handle('connection-1', rawBody, validHeaders);

  const record = await integration.webhooks.handle('connection-1', rawBody, {
    'x-github-delivery': 'delivery-2',
    'x-github-event': 'issues',
    'x-hub-signature-256': 'sha256=bad',
  });

  assert.equal(record.signatureValid, false);
  assert.equal(record.status, 'rejected');

  const records = await harness.state.webhooks.list();
  assert.equal(records.length, 2);
});

test('malformed and unsupported webhook requests are rejected before persistence', async () => {
  const harness = createTestHarness(['github.issue.read']);
  const integration = createGitHubIntegrationForTesting({ ...harness, resolveWebhookSecret: async () => 'secret' });
  await integration.upsertConnection(fixtureConnection());

  await assert.rejects(
    integration.webhooks.handle('connection-1', '{}', {
      'x-github-delivery': 'delivery-3',
      'x-github-event': 'unsupported',
      'x-hub-signature-256': signGitHubWebhook('{}', 'secret'),
    }),
    /Invalid webhook payload/,
  );
  await assert.rejects(
    integration.webhooks.handle('connection-1', '[]', {
      'x-github-delivery': 'delivery-4',
      'x-github-event': 'issues',
      'x-hub-signature-256': signGitHubWebhook('[]', 'secret'),
    }),
    /Invalid webhook payload/,
  );

  assert.equal((await harness.state.webhooks.list()).length, 0);
});

test('ui discovery exposes only capability-filtered surfaces', async () => {
  const harness = createTestHarness(['github.pull_request.create', 'github.pull_request.merge']);
  const integration = createGitHubIntegrationForTesting({ ...harness, resolveWebhookSecret: async () => 'secret' });
  await integration.upsertConnection(fixtureConnection());

  const ui = await integration.ui('github.integration');
  const surfaceIds = ui.surfaces.map((surface) => surface.id);
  const pullRequests = ui.surfaces.find((surface) => surface.id === 'pull-requests');

  assert.equal(ui.protocol, 'AppPort/ui/1');
  assert.deepEqual(surfaceIds, ['connection', 'pull-requests']);
  assert.ok(pullRequests);
  assert.deepEqual(
    pullRequests?.actions.map((action) => [action.capability, action.authorized]),
    [
      ['github.pull_request.create', true],
      ['github.pull_request.merge', true],
    ],
  );
});

test('ui discovery selects the connection for the requested application id', async () => {
  const harness = createTestHarness(['github.pull_request.create']);
  const integration = createGitHubIntegrationForTesting({ ...harness, resolveWebhookSecret: async () => 'secret' });
  await integration.upsertConnection({ ...fixtureConnection(), id: 'connection-2', applicationId: 'other.application', status: 'needs_authorization' });
  await integration.upsertConnection(fixtureConnection());

  const ui = await integration.ui('github.integration');
  assert.equal(ui.configuration.status, 'configured');
});

test('durable state survives restart when FeltDB uses the same path', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'github-integration-state-'));
  try {
    const stateA = createGitHubIntegrationState({ namespace: 'github-integration-restart', path: root });
    const harnessA = createTestHarness(['github.repository.read']);
    const integrationA = createGitHubIntegrationForTesting({ state: stateA, authority: harnessA.authority, transport: harnessA.transport, resolveWebhookSecret: async () => 'secret' });
    await integrationA.upsertConnection(fixtureConnection());

    const stateB = createGitHubIntegrationState({ namespace: 'github-integration-restart', path: root });
    const harnessB = createTestHarness(['github.repository.read']);
    const integrationB = createGitHubIntegrationForTesting({ state: stateB, authority: harnessB.authority, transport: harnessB.transport, resolveWebhookSecret: async () => 'secret' });
    const connection = await integrationB.getConnection('connection-1');

    assert.equal(connection?.id, 'connection-1');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
