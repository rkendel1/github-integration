import { readFileSync } from 'node:fs';
import { s, toJSONSchema } from '@appport/sdk';
import type { ApplicationManifest, JsonValue } from '@appport/sdk';
import type { GitHubCapabilityName } from './types.js';

export interface CapabilityContract {
  name: GitHubCapabilityName;
  version: 1;
  description: string;
  authorization: readonly [GitHubCapabilityName];
  mutates: boolean;
  inputSchema: JsonValue;
  outputSchema: JsonValue;
}

// Runtime capability identity is derived from the packaged feltdb.flow. TypeScript does
// not maintain a second capability registry.
const canonicalFlow = readFileSync(new URL('../../feltdb.flow', import.meta.url), 'utf8');
export const capabilityNames = [...canonicalFlow.matchAll(/^\s*operation\s+([a-z0-9_.]+)\s*$/gm)]
  .map((match) => match[1] as GitHubCapabilityName);

if (capabilityNames.length === 0 || new Set(capabilityNames).size !== capabilityNames.length) {
  throw new Error('Canonical feltdb.flow must declare a unique, non-empty GitHub capability set.');
}

const genericInput = toJSONSchema(s.record(s.string())) as JsonValue;
const genericOutput = toJSONSchema(s.union([s.record(s.string()), s.array(s.record(s.string()))])) as JsonValue;

export const capabilityContracts: CapabilityContract[] = capabilityNames.map((name) => ({
  name,
  version: 1,
  description: `Normalized operation ${name} declared by the canonical feltdb.flow.`,
  authorization: [name],
  mutates: !name.endsWith('.read'),
  inputSchema: genericInput,
  outputSchema: genericOutput,
}));

export const mutationCapabilities = new Set(
  capabilityContracts.filter((capability) => capability.mutates).map((capability) => capability.name),
);

/** Standard AppPort provider contract derived from the canonical FlowSpec operations. */
export const githubAppPortManifest: ApplicationManifest = Object.freeze({
  protocol: 'AppPort/1',
  application: {
    id: 'github',
    name: 'GitHub',
    version: '1.0.1',
  },
  metadata: {
    service: 'github',
    declaration: 'use github',
    credentialBoundary: '@appport/services',
    authentication: {
      publicRepositoryAccess: 'credential-free',
      authenticatedAccess: 'credential-reference',
      mechanisms: ['github_app', 'oauth_token', 'personal_access_token'],
    },
    persistenceAuthority: 'feltdb',
    persistenceContract: 'feltdb.flow',
  },
  provides: capabilityContracts.map((capability) => ({
    name: capability.name,
    version: capability.version,
    kind: 'request' as const,
    description: capability.description,
    inputSchema: capability.inputSchema,
    outputSchema: capability.outputSchema,
    authorization: capability.authorization,
    effect: capability.mutates ? 'consequential' as const : 'observation' as const,
    emits: [],
    deprecated: false,
  })),
  requires: [],
});
