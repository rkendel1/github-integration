import { readFileSync } from 'node:fs';
import { s, toJSONSchema } from '@appport/sdk';
import type { GitHubCapabilityName } from './types.js';

export interface CapabilityContract {
  name: GitHubCapabilityName;
  version: 1;
  description: string;
  authorization: readonly [GitHubCapabilityName];
  mutates: boolean;
  inputSchema: unknown;
  outputSchema: unknown;
}

// Runtime capability identity is derived from the packaged .flow. TypeScript does
// not maintain a second capability registry.
const canonicalFlow = readFileSync(new URL('../../.flow', import.meta.url), 'utf8');
export const capabilityNames = [...canonicalFlow.matchAll(/^\s*operation\s+([a-z0-9_.]+)\s*$/gm)]
  .map((match) => match[1] as GitHubCapabilityName);

if (capabilityNames.length === 0 || new Set(capabilityNames).size !== capabilityNames.length) {
  throw new Error('Canonical .flow must declare a unique, non-empty GitHub capability set.');
}

const genericInput = toJSONSchema(s.record(s.string()));
const genericOutput = toJSONSchema(s.union([s.record(s.string()), s.array(s.record(s.string()))]));

export const capabilityContracts: CapabilityContract[] = capabilityNames.map((name) => ({
  name,
  version: 1,
  description: `Normalized operation ${name} declared by the canonical .flow.`,
  authorization: [name],
  mutates: !name.endsWith('.read'),
  inputSchema: genericInput,
  outputSchema: genericOutput,
}));

export const mutationCapabilities = new Set(
  capabilityContracts.filter((capability) => capability.mutates).map((capability) => capability.name),
);
