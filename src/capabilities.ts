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

function capability(name: GitHubCapabilityName, description: string, mutates: boolean, inputSchema: unknown, outputSchema: unknown): CapabilityContract {
  return {
    name,
    version: 1,
    description,
    authorization: [name],
    mutates,
    inputSchema,
    outputSchema,
  };
}

const connectionInput = toJSONSchema(s.object({ connectionId: s.string() }));
const ownerRepoInput = toJSONSchema(s.object({ connectionId: s.string(), owner: s.string(), repository: s.string() }));
const branchInput = toJSONSchema(s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), branch: s.string() }));
const issueInput = toJSONSchema(s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), issueNumber: s.integer() }));
const pullInput = toJSONSchema(s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), pullNumber: s.integer() }));
const listOutput = toJSONSchema(s.array(s.record(s.string())));
const itemOutput = toJSONSchema(s.record(s.string()));

export const capabilityContracts: CapabilityContract[] = [
  capability('github.organization.read', 'List or get GitHub organizations.', false, connectionInput, listOutput),
  capability('github.repository.read', 'List or get GitHub repositories.', false, ownerRepoInput, listOutput),
  capability('github.branch.read', 'List or get GitHub branches.', false, ownerRepoInput, listOutput),
  capability('github.branch.create', 'Create a GitHub branch.', true, toJSONSchema(s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), branch: s.string(), fromSha: s.string() })), itemOutput),
  capability('github.commit.read', 'List or get GitHub commits.', false, ownerRepoInput, listOutput),
  capability('github.issue.read', 'List or get GitHub issues.', false, ownerRepoInput, listOutput),
  capability('github.issue.create', 'Create a GitHub issue.', true, toJSONSchema(s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), title: s.string(), body: s.optional(s.string()) })), itemOutput),
  capability('github.issue.update', 'Update a GitHub issue.', true, issueInput, itemOutput),
  capability('github.issue.comment', 'Comment on a GitHub issue.', true, toJSONSchema(s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), issueNumber: s.integer(), body: s.string() })), itemOutput),
  capability('github.pull_request.read', 'List or get GitHub pull requests.', false, ownerRepoInput, listOutput),
  capability('github.pull_request.create', 'Create a GitHub pull request.', true, toJSONSchema(s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), title: s.string(), head: s.string(), base: s.string(), body: s.optional(s.string()) })), itemOutput),
  capability('github.pull_request.update', 'Update a GitHub pull request.', true, pullInput, itemOutput),
  capability('github.pull_request.comment', 'Comment on a GitHub pull request.', true, toJSONSchema(s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), pullNumber: s.integer(), body: s.string() })), itemOutput),
  capability('github.pull_request.review', 'Review a GitHub pull request.', true, toJSONSchema(s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), pullNumber: s.integer(), event: s.string(), body: s.optional(s.string()) })), itemOutput),
  capability('github.pull_request.merge', 'Merge a GitHub pull request.', true, pullInput, itemOutput),
];

export const capabilityNames = capabilityContracts.map((capability) => capability.name);
export const mutationCapabilities = new Set(capabilityContracts.filter((capability) => capability.mutates).map((capability) => capability.name));
export const capabilityMap = new Map(capabilityContracts.map((capability) => [capability.name, capability]));
