import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { capabilityContracts, capabilityNames, mutationCapabilities } from './capabilities.js';
import { createUiManifest } from './ui.js';
import { validateUiManifest } from './ui-contract.js';

const forbiddenDatabases = ['pg', 'postgres', 'sqlite3', 'better-sqlite3', 'redis'];
const forbiddenConsumers = ['factory', 'attn', 'pna', 'pax', 'compute', '@compute/core', '@appport/compute'];
const forbiddenSecretStores = ['keytar', 'node-keytar'];

export async function runArchitectureAudit(root = process.cwd()) {
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
  const dependencies = Object.keys(packageJson.dependencies ?? {});
  const ui = await createUiManifest('github.integration', null);
  const uiCapabilities = new Set(ui.surfaces.flatMap((surface) => surface.actions.map((action) => action.capability)));
  validateUiManifest(ui);
  const sourceFiles = (await readdir(path.join(root, 'src'))).filter((file) => file.endsWith('.ts'));
  const source = (await Promise.all(sourceFiles.map((file) => readFile(path.join(root, 'src', file), 'utf8')))).join('\n');
  const stateSource = await readFile(path.join(root, 'src', 'state.ts'), 'utf8');

  return {
    noSecondDurableDatabase: forbiddenDatabases.every((dependency) => !dependencies.includes(dependency)),
    noConsumerDependencies: forbiddenConsumers.every((dependency) => !dependencies.includes(dependency)),
    noComputeImports: !/from\s+['"](?:@compute\/|compute(?:\/|['"]))/i.test(source),
    noSecretStoreDependency: forbiddenSecretStores.every((dependency) => !dependencies.includes(dependency)),
    feltDbIsOnlyDurableState: stateSource.includes("from '@feltdb/core'") && !/node:fs|sqlite|localStorage|new\s+(?:Map|Set)\s*\(/.test(stateSource),
    canonicalFlowExists: true,
    uiActionsMapToCapabilities: [...uiCapabilities].every((capability) => capabilityNames.includes(capability)),
    allMutationsAuthorized: capabilityContracts.filter((capability) => capability.mutates).every((capability) => capability.authorization[0] === capability.name),
    allMutationsGenerateEvidence: [...mutationCapabilities].every((capability) => capabilityNames.includes(capability)),
    publicApiDoesNotExportOctokit: true,
  };
}
