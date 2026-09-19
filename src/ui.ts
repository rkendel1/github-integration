import { capabilityNames } from './capabilities.js';
import { requiredConfiguration } from './platform.js';
import type { AuthorityBoundary, GitHubConnection, GitHubUiManifest } from './types.js';

async function allowedCapabilities(authority: AuthorityBoundary | undefined): Promise<Set<string>> {
  if (!authority) {
    return new Set();
  }
  try {
    const auth = await authority.session();
    return new Set(auth.capabilities);
  } catch {
    return new Set();
  }
}

export async function createUiManifest(applicationId: string, connection: GitHubConnection | null, authority?: AuthorityBoundary): Promise<GitHubUiManifest> {
  const allowed = await allowedCapabilities(authority);
  const action = (id: string, label: string, capability: (typeof capabilityNames)[number]) => ({
    id,
    label,
    capability,
    authorized: allowed.has(capability),
  });

  return {
    application: {
      id: applicationId,
      name: 'GitHub Integration',
    },
    configuration: {
      status: connection?.status ?? 'missing',
      requirements: [...requiredConfiguration],
    },
    surfaces: [
      { id: 'connection', label: 'Connection', actions: [] },
      { id: 'organizations', label: 'Organizations', actions: [action('organization-list', 'List Organizations', 'github.organization.read')] },
      { id: 'repositories', label: 'Repositories', actions: [action('repository-list', 'List Repositories', 'github.repository.read')] },
      { id: 'pull-requests', label: 'Pull Requests', actions: [action('pull-request-create', 'Create Pull Request', 'github.pull_request.create'), action('pull-request-merge', 'Merge Pull Request', 'github.pull_request.merge')] },
      { id: 'issues', label: 'Issues', actions: [action('issue-create', 'Create Issue', 'github.issue.create'), action('issue-comment', 'Comment Issue', 'github.issue.comment')] },
      { id: 'activity', label: 'Activity', actions: [action('branch-create', 'Create Branch', 'github.branch.create')] },
    ],
  };
}
