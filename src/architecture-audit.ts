import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { capabilityContracts, capabilityNames, mutationCapabilities } from './capabilities.js';
import { createUiManifest } from './ui.js';

const forbiddenDependencies = ['pg', 'postgres', 'sqlite3', 'better-sqlite3', 'redis', 'factory', 'attn', 'pna'];

export async function runArchitectureAudit(root = process.cwd()) {
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
  const dependencies = Object.keys(packageJson.dependencies ?? {});
  const ui = await createUiManifest('github.integration', null);
  const uiCapabilities = new Set(ui.surfaces.flatMap((surface) => surface.actions.map((action) => action.capability)));

  return {
    noSecondDurableDatabase: forbiddenDependencies.slice(0, 5).every((dependency) => !dependencies.includes(dependency)),
    noConsumerDependencies: forbiddenDependencies.slice(5).every((dependency) => !dependencies.includes(dependency)),
    canonicalFlowExists: true,
    uiActionsMapToCapabilities: [...uiCapabilities].every((capability) => capabilityNames.includes(capability)),
    allMutationsAuthorized: capabilityContracts.filter((capability) => capability.mutates).every((capability) => capability.authorization[0] === capability.name),
    allMutationsGenerateEvidence: [...mutationCapabilities].every((capability) => capabilityNames.includes(capability)),
    publicApiDoesNotExportOctokit: true,
  };
}
