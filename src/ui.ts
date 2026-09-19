import { requiredConfiguration } from './platform.js';
import { APPPORT_UI_PROTOCOL, REQUIRED_COMPOSITION_CONTEXT } from './ui-contract.js';
import type { AuthorityBoundary, GitHubConnection, GitHubUiAction, GitHubUiManifest, GitHubUiSurface } from './types.js';

async function allowedCapabilities(authority: AuthorityBoundary | undefined): Promise<Set<string> | null> {
  if (!authority) {
    return null;
  }
  try {
    const auth = await authority.session();
    return new Set(auth.capabilities);
  } catch {
    return null;
  }
}

function filterActions(actions: GitHubUiAction[], allowed: Set<string> | null): GitHubUiAction[] {
  if (!allowed) {
    return [];
  }
  return actions.filter((action) => allowed.has(action.capability));
}

function surface(id: string, label: string, route: string, actions: GitHubUiAction[]): GitHubUiSurface {
  return { id, label, route, actions };
}

export async function createUiManifest(applicationId: string, connection: GitHubConnection | null, authority?: AuthorityBoundary): Promise<GitHubUiManifest> {
  const allowed = await allowedCapabilities(authority);
  const action = (id: string, label: string, capability: GitHubUiAction['capability'], route: string): GitHubUiAction => ({
    id,
    label,
    capability,
    authorized: Boolean(allowed?.has(capability)),
    route,
  });

  const surfaces = [
    surface('connection', 'Connection', '/connection', []),
    surface('organizations', 'Organizations', '/organizations', filterActions([
      action('organization-list', 'List Organizations', 'github.organization.read', '/organizations'),
    ], allowed)),
    surface('repositories', 'Repositories', '/repositories', filterActions([
      action('repository-list', 'List Repositories', 'github.repository.read', '/repositories'),
    ], allowed)),
    surface('pull-requests', 'Pull Requests', '/pull-requests', filterActions([
      action('pull-request-read', 'View Pull Requests', 'github.pull_request.read', '/pull-requests'),
      action('pull-request-create', 'Create Pull Request', 'github.pull_request.create', '/pull-requests/new'),
      action('pull-request-merge', 'Merge Pull Request', 'github.pull_request.merge', '/pull-requests'),
    ], allowed)),
    surface('issues', 'Issues', '/issues', filterActions([
      action('issue-read', 'View Issues', 'github.issue.read', '/issues'),
      action('issue-create', 'Create Issue', 'github.issue.create', '/issues/new'),
      action('issue-comment', 'Comment Issue', 'github.issue.comment', '/issues'),
    ], allowed)),
    surface('activity', 'Activity', '/activity', filterActions([
      action('commit-read', 'View Activity', 'github.commit.read', '/activity'),
      action('branch-create', 'Create Branch', 'github.branch.create', '/activity'),
    ], allowed)),
  ].filter((surface) => surface.id === 'connection' || surface.actions.length > 0);

  return {
    protocol: APPPORT_UI_PROTOCOL,
    application: {
      id: applicationId,
      name: 'GitHub Integration',
    },
    navigation: surfaces.map(({ id, label, route }) => ({ id, label, route })),
    composition: {
      context: REQUIRED_COMPOSITION_CONTEXT,
    },
    configuration: {
      applicationId,
      environment: connection?.environment,
      status: connection?.status ?? 'missing',
      requirements: [...requiredConfiguration],
    },
    surfaces,
  };
}
