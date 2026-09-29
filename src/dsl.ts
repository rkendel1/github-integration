import { capabilityNames } from './capabilities.js';
import type { GitHubCapabilityName } from './types.js';

export const githubCapabilityGroups = [
  'organizations',
  'repositories',
  'webhooks',
  'pull_requests',
  'issues',
] as const;

export type GitHubCapabilityGroup = typeof githubCapabilityGroups[number];

const operationsByGroup: Readonly<Record<GitHubCapabilityGroup, readonly GitHubCapabilityName[]>> = {
  organizations: ['github.organization.read'],
  repositories: [
    'github.repository.read',
    'github.branch.read',
    'github.branch.create',
    'github.commit.read',
  ],
  webhooks: [],
  pull_requests: [
    'github.pull_request.read',
    'github.pull_request.create',
    'github.pull_request.update',
    'github.pull_request.comment',
    'github.pull_request.review',
    'github.pull_request.merge',
  ],
  issues: [
    'github.issue.read',
    'github.issue.create',
    'github.issue.update',
    'github.issue.comment',
  ],
};

export interface GitHubCapabilityDeclaration {
  readonly service: 'github';
  readonly syntax: 'use github';
  readonly groups: readonly GitHubCapabilityGroup[];
  readonly operations: readonly GitHubCapabilityName[];
}

export class GitHubDslError extends Error {
  constructor(readonly file: string, message: string) {
    super(`${file}: ${message}`);
    this.name = 'GitHubDslError';
  }
}

/** Parse the GitHub portion of an AppPort appport.toml contract. */
export function parseGitHubCapabilityDeclaration(source: string, file = 'appport.toml'): GitHubCapabilityDeclaration {
  const lines = source.split(/\r?\n/);
  let declarationFound = false;
  let block = false;
  let blockWasUsed = false;
  const selected = new Set<GitHubCapabilityGroup>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!.trim();
    if (!line || line.startsWith('#')) continue;

    if (block) {
      if (line === '}') {
        block = false;
        continue;
      }
      const property = /^([a-z][a-z0-9_]*)\s*=\s*(true|false)$/.exec(line);
      if (!property || !githubCapabilityGroups.includes(property[1] as GitHubCapabilityGroup)) {
        throw new GitHubDslError(file, `invalid GitHub capability at line ${index + 1}; expected one of ${githubCapabilityGroups.join(', ')}`);
      }
      if (property[2] === 'true') selected.add(property[1] as GitHubCapabilityGroup);
      continue;
    }

    if (line === 'use github') {
      if (declarationFound) throw new GitHubDslError(file, 'duplicate "use github" declaration');
      declarationFound = true;
      continue;
    }
    if (line === 'use github {') {
      if (declarationFound) throw new GitHubDslError(file, 'duplicate "use github" declaration');
      declarationFound = true;
      block = true;
      blockWasUsed = true;
      continue;
    }
    if (/^use\s+github\b/.test(line)) {
      throw new GitHubDslError(file, 'use "use github" or an AppPort capability block such as "use github { repositories = true }"');
    }
  }

  if (block) throw new GitHubDslError(file, 'unterminated "use github" capability block');
  if (!declarationFound) throw new GitHubDslError(file, 'missing "use github" declaration');
  if (blockWasUsed && selected.size === 0) throw new GitHubDslError(file, 'the "use github" block must enable at least one capability');

  const groups = blockWasUsed ? githubCapabilityGroups.filter((group) => selected.has(group)) : [...githubCapabilityGroups];
  const declaredOperations = new Set(capabilityNames);
  const operations = groups.flatMap((group) => operationsByGroup[group]).filter((operation) => declaredOperations.has(operation));
  return Object.freeze({ service: 'github', syntax: 'use github', groups: Object.freeze(groups), operations: Object.freeze(operations) });
}
