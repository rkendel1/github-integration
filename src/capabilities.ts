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
const repositoryLocatorSchema = s.object({ connectionId: s.string(), owner: s.string(), repository: s.string() });
const issueLocatorSchema = s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), issueNumber: s.integer() });
const pullRequestLocatorSchema = s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), pullNumber: s.integer() });
const branchLocatorSchema = s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), branch: s.string() });
const createIssueSchema = s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), title: s.string(), body: s.optional(s.string()) });
const updateIssueSchema = s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), issueNumber: s.integer(), title: s.optional(s.string()), body: s.optional(s.string()), state: s.optional(s.string()) });
const commentIssueSchema = s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), issueNumber: s.integer(), body: s.string() });
const createPullRequestSchema = s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), title: s.string(), head: s.string(), base: s.string(), body: s.optional(s.string()) });
const updatePullRequestSchema = s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), pullNumber: s.integer(), title: s.optional(s.string()), body: s.optional(s.string()), state: s.optional(s.string()) });
const commentPullRequestSchema = s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), pullNumber: s.integer(), body: s.string() });
const reviewPullRequestSchema = s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), pullNumber: s.integer(), event: s.string(), body: s.optional(s.string()) });
const mergePullRequestSchema = s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), pullNumber: s.integer(), method: s.optional(s.string()) });
const createBranchSchema = s.object({ connectionId: s.string(), owner: s.string(), repository: s.string(), branch: s.string(), fromSha: s.string() });

const ownerRepoInput = toJSONSchema(repositoryLocatorSchema);
const issueInput = toJSONSchema(issueLocatorSchema);
const pullInput = toJSONSchema(pullRequestLocatorSchema);
const branchInput = toJSONSchema(branchLocatorSchema);
const listOutput = toJSONSchema(s.array(s.record(s.string())));
const itemOutput = toJSONSchema(s.record(s.string()));
const readOutput = toJSONSchema(s.union([s.record(s.string()), s.array(s.record(s.string()))]));

export const capabilityContracts: CapabilityContract[] = [
  capability('github.organization.read', 'List or get GitHub organizations.', false, connectionInput, readOutput),
  capability('github.repository.read', 'List or get GitHub repositories.', false, ownerRepoInput, readOutput),
  capability('github.branch.read', 'List or get GitHub branches.', false, ownerRepoInput, readOutput),
  capability('github.branch.create', 'Create a GitHub branch.', true, toJSONSchema(createBranchSchema), itemOutput),
  capability('github.commit.read', 'List or get GitHub commits.', false, ownerRepoInput, readOutput),
  capability('github.issue.read', 'List or get GitHub issues.', false, ownerRepoInput, readOutput),
  capability('github.issue.create', 'Create a GitHub issue.', true, toJSONSchema(createIssueSchema), itemOutput),
  capability('github.issue.update', 'Update a GitHub issue.', true, toJSONSchema(updateIssueSchema), itemOutput),
  capability('github.issue.comment', 'Comment on a GitHub issue.', true, toJSONSchema(commentIssueSchema), itemOutput),
  capability('github.pull_request.read', 'List or get GitHub pull requests.', false, ownerRepoInput, readOutput),
  capability('github.pull_request.create', 'Create a GitHub pull request.', true, toJSONSchema(createPullRequestSchema), itemOutput),
  capability('github.pull_request.update', 'Update a GitHub pull request.', true, toJSONSchema(updatePullRequestSchema), itemOutput),
  capability('github.pull_request.comment', 'Comment on a GitHub pull request.', true, toJSONSchema(commentPullRequestSchema), itemOutput),
  capability('github.pull_request.review', 'Review a GitHub pull request.', true, toJSONSchema(reviewPullRequestSchema), itemOutput),
  capability('github.pull_request.merge', 'Merge a GitHub pull request.', true, toJSONSchema(mergePullRequestSchema), itemOutput),
];

export const capabilityNames = capabilityContracts.map((capability) => capability.name);
export const mutationCapabilities = new Set(capabilityContracts.filter((capability) => capability.mutates).map((capability) => capability.name));
export const capabilityMap = new Map(capabilityContracts.map((capability) => [capability.name, capability]));
