import test from 'node:test';
import assert from 'node:assert/strict';
import { createUiManifest } from '../src/ui.js';
import { composeUi, validateUiManifest } from '../src/ui-contract.js';
import { createStaticAuthority } from '../src/auth.js';
import { fixtureAuth, fixtureConnection } from './helpers.js';
import type { GitHubUiManifest } from '../src/types.js';

function validManifest(): GitHubUiManifest {
  return {
    protocol: 'AppPort/ui/1',
    application: { id: 'github.integration', name: 'GitHub Integration' },
    navigation: [{ id: 'connection', label: 'Connection', route: '/connection' }],
    composition: { context: ['identity', 'tenant', 'application', 'environment', 'capabilities'] },
    configuration: { applicationId: 'github.integration', status: 'configured', requirements: [{ id: 'github.connection', kind: 'connection', secret: false }] },
    surfaces: [{ id: 'connection', label: 'Connection', route: '/connection', actions: [] }],
  };
}

test('AppPort/ui/1 manifest validates', () => {
  assert.doesNotThrow(() => validateUiManifest(validManifest()));
});

test('duplicate surface ids are rejected', () => {
  const manifest = validManifest();
  manifest.surfaces.push({ id: 'connection', label: 'Duplicate', route: '/duplicate', actions: [] });
  assert.throws(() => validateUiManifest(manifest), /Duplicate surface id/);
});

test('invalid routes are rejected', () => {
  const manifest = validManifest();
  manifest.surfaces[0]!.route = 'connection';
  assert.throws(() => validateUiManifest(manifest), /Invalid route/);
});

test('invalid capability references are rejected', () => {
  const manifest = validManifest();
  manifest.surfaces[0]!.actions.push({ id: 'bad', label: 'Bad', capability: 'github.invalid' as never, authorized: false, route: '/bad' });
  assert.throws(() => validateUiManifest(manifest), /Invalid capability reference/);
});

test('invalid composition requirements are rejected', () => {
  const manifest = validManifest();
  manifest.composition.context = ['identity', 'tenant', 'application', 'environment', 'capabilities', 'portal'] as never;
  assert.throws(() => validateUiManifest(manifest), /Invalid composition requirement/);
});

test('contextual discovery filters to available capabilities', async () => {
  const ui = await createUiManifest('github.integration', fixtureConnection(), createStaticAuthority(fixtureAuth(['github.issue.create'])));
  assert.deepEqual(ui.surfaces.map((surface) => surface.id), ['connection', 'issues']);
});

test('standalone mode still exposes connection surface', async () => {
  const ui = await createUiManifest('github.integration', fixtureConnection());
  assert.deepEqual(ui.surfaces.map((surface) => surface.id), ['connection']);
});

test('multi-product composition works without GitHub-specific host code', () => {
  const githubUi = validManifest();
  const otherUi: GitHubUiManifest = {
    protocol: 'AppPort/ui/1',
    application: { id: 'other.product', name: 'Other Product' },
    navigation: [{ id: 'other-home', label: 'Other', route: '/other' }],
    composition: { context: ['identity', 'tenant', 'application', 'environment', 'capabilities'] },
    configuration: { applicationId: 'other.product', status: 'missing', requirements: [] },
    surfaces: [{ id: 'other-home', label: 'Other', route: '/other', actions: [] }],
  };

  const composed = composeUi([githubUi, otherUi], { application: 'host' });
  assert.deepEqual(composed.surfaces.map((surface) => surface.id), ['github.integration:connection', 'other.product:other-home']);
});
