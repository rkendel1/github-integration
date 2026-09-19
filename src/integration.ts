import { randomUUID } from 'node:crypto';
import { createAuthBoundry } from '@authboundry/core';
import { createCanonicalInvocationContext } from './auth.js';
import { capabilityMap, mutationCapabilities } from './capabilities.js';
import { createOctokitTransport, type TokenResolver } from './octokit.js';
import { appBoundryContract } from './platform.js';
import { createGitHubIntegrationState, type GitHubIntegrationState } from './state.js';
import { createUiManifest } from './ui.js';
import { normalizeGitHubWebhookEvent, verifyGitHubWebhookSignature } from './webhooks.js';
import type {
  AuthorityBoundary,
  CommentIssueInput,
  CommentPullRequestInput,
  CreateBranchInput,
  CreateIssueInput,
  CreatePullRequestInput,
  GetBranchInput,
  GetCommitInput,
  GetIssueInput,
  GetOrganizationInput,
  GetPullRequestInput,
  GetRepositoryInput,
  GitHubCapabilityName,
  GitHubConnection,
  GitHubEvidenceRecord,
  GitHubOperationRecord,
  GitHubPullRequest,
  GitHubResourceRef,
  GitHubTransport,
  InvocationInput,
  ListBranchesInput,
  ListCommitsInput,
  ListIssuesInput,
  ListOrganizationsInput,
  ListPullRequestsInput,
  ListRepositoriesInput,
  MergePullRequestInput,
  ReviewPullRequestInput,
  UpdateIssueInput,
  UpdatePullRequestInput,
} from './types.js';

export class InvalidWebhookPayloadError extends Error {
  constructor() {
    super('Invalid webhook payload');
  }
}

export interface GitHubIntegrationOptions {
  state?: GitHubIntegrationState;
  transport?: GitHubTransport;
  authority?: AuthorityBoundary;
  resolveGitHubToken?: TokenResolver;
  resolveWebhookSecret?: (connection: GitHubConnection) => Promise<string>;
}

function now(): string {
  return new Date().toISOString();
}

function getResourceRef(result: unknown, fallback: Partial<GitHubResourceRef>): GitHubResourceRef | undefined {
  if (!fallback.type || !fallback.identifier) {
    return undefined;
  }
  return {
    type: fallback.type,
    identifier: fallback.identifier,
    owner: fallback.owner,
    repository: fallback.repository,
    nodeId: (result as { nodeId?: string })?.nodeId,
    sha: (result as { sha?: string })?.sha,
  };
}

async function defaultWebhookSecretResolver(): Promise<string> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('Missing GitHub webhook secret resolver.');
  }
  return secret;
}

async function defaultTokenResolver(): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('Missing GitHub token resolver.');
  }
  return token;
}

async function loadConnection(state: GitHubIntegrationState, connectionId: string): Promise<GitHubConnection> {
  const connection = await state.connections.get(connectionId);
  if (!connection) {
    throw new Error(`Unknown GitHub connection: ${connectionId}`);
  }
  return connection;
}

async function putOperation(state: GitHubIntegrationState, record: GitHubOperationRecord): Promise<void> {
  await state.operations.insert(record, record.id);
}

async function putEvidence(state: GitHubIntegrationState, record: GitHubEvidenceRecord): Promise<void> {
  await state.evidence.insert(record, record.id);
}

async function updateOperation(state: GitHubIntegrationState, operation: GitHubOperationRecord): Promise<void> {
  await state.operations.update(operation.id, operation);
}

function pickPreferredConnection(connections: GitHubConnection[]): GitHubConnection | null {
  if (connections.length === 0) {
    return null;
  }
  const priority = { configured: 0, needs_authorization: 1, invalid: 2, missing: 3 } as const;
  return [...connections].sort((left, right) => {
    const statusOrder = priority[left.status] - priority[right.status];
    if (statusOrder !== 0) {
      return statusOrder;
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  })[0] ?? null;
}

export function createGitHubIntegration(options: GitHubIntegrationOptions = {}) {
  const state = options.state ?? createGitHubIntegrationState();
  const authority = options.authority ?? createAuthBoundry({ baseUrl: process.env.AUTHBOUNDRY_URL });
  const transport = options.transport ?? createOctokitTransport(options.resolveGitHubToken ?? defaultTokenResolver);
  const resolveWebhookSecret = options.resolveWebhookSecret ?? defaultWebhookSecretResolver;

  async function runOperation<Result>(
    capability: GitHubCapabilityName,
    connectionId: string,
    invocation: InvocationInput,
    resource: Partial<GitHubResourceRef>,
    execute: (connection: GitHubConnection, context: Awaited<ReturnType<typeof createCanonicalInvocationContext>>) => Promise<Result>,
  ): Promise<Result> {
    const connection = await loadConnection(state, connectionId);
    const context = await createCanonicalInvocationContext(authority, invocation, capability);
    const operation: GitHubOperationRecord = {
      id: randomUUID(),
      capability,
      principalId: context.principalId,
      tenantId: context.tenantId,
      applicationId: context.applicationId,
      connectionId,
      resourceType: resource.type,
      resourceId: resource.identifier,
      status: 'requested',
      createdAt: now(),
      updatedAt: now(),
    };
    await putOperation(state, operation);

    try {
      const result = await execute(connection, context);
      const completed: GitHubOperationRecord = { ...operation, status: 'completed', updatedAt: now() };
      await updateOperation(state, completed);
      const evidence: GitHubEvidenceRecord = {
        id: randomUUID(),
        operationId: operation.id,
        capability,
        principalId: context.principalId,
        tenantId: context.tenantId,
        applicationId: context.applicationId,
        result: 'succeeded',
        githubResource: getResourceRef(result, resource),
        timestamp: now(),
      };
      if (mutationCapabilities.has(capability)) {
        await putEvidence(state, evidence);
      }
      return result;
    } catch (error) {
      const failed: GitHubOperationRecord = {
        ...operation,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        updatedAt: now(),
      };
      await updateOperation(state, failed);
      if (mutationCapabilities.has(capability)) {
        await putEvidence(state, {
          id: randomUUID(),
          operationId: operation.id,
          capability,
          principalId: context.principalId,
          tenantId: context.tenantId,
          applicationId: context.applicationId,
          result: 'failed',
          githubResource: getResourceRef(undefined, resource),
          timestamp: now(),
        });
      }
      throw error;
    }
  }

  return {
    appBoundryContract,
    state,
    capabilityContracts: [...capabilityMap.values()],
    async upsertConnection(connection: GitHubConnection): Promise<GitHubConnection> {
      await state.connections.insert(connection, connection.id);
      return connection;
    },
    async getConnection(connectionId: string): Promise<GitHubConnection | null> {
      return state.connections.get(connectionId);
    },
    async ui(applicationId: string, authorityOverride?: AuthorityBoundary): Promise<Awaited<ReturnType<typeof createUiManifest>>> {
      const matches = await state.connections.find({ applicationId });
      const connection = pickPreferredConnection(matches);
      return createUiManifest(applicationId, connection, authorityOverride ?? authority);
    },
    organizations: {
      list: (input: ListOrganizationsInput, invocation: InvocationInput) => runOperation('github.organization.read', input.connectionId, invocation, { type: 'organization', identifier: 'list' }, async (connection, context) => transport.organizations.list(connection, context, input)),
      get: (input: GetOrganizationInput, invocation: InvocationInput) => runOperation('github.organization.read', input.connectionId, invocation, { type: 'organization', identifier: input.organization }, async (connection, context) => transport.organizations.get(connection, context, input)),
    },
    repositories: {
      list: (input: ListRepositoriesInput, invocation: InvocationInput) => runOperation('github.repository.read', input.connectionId, invocation, { type: 'repository', identifier: input.organization ?? 'self' }, async (connection, context) => transport.repositories.list(connection, context, input)),
      get: async (input: GetRepositoryInput, invocation: InvocationInput) => {
        const repository = await runOperation('github.repository.read', input.connectionId, invocation, { type: 'repository', identifier: `${input.owner}/${input.repository}`, owner: input.owner, repository: input.repository }, async (connection, context) => {
          return transport.repositories.get(connection, context, input);
        });
        await state.repositories.insert({ ...repository, connectionId: input.connectionId }, `${input.connectionId}:${repository.owner}/${repository.name}`);
        return repository;
      },
    },
    branches: {
      list: (input: ListBranchesInput, invocation: InvocationInput) => runOperation('github.branch.read', input.connectionId, invocation, { type: 'branch', identifier: `${input.owner}/${input.repository}` }, async (connection, context) => transport.branches.list(connection, context, input)),
      get: (input: GetBranchInput, invocation: InvocationInput) => runOperation('github.branch.read', input.connectionId, invocation, { type: 'branch', identifier: input.branch, owner: input.owner, repository: input.repository }, async (connection, context) => transport.branches.get(connection, context, input)),
      create: (input: CreateBranchInput, invocation: InvocationInput) => runOperation('github.branch.create', input.connectionId, invocation, { type: 'branch', identifier: input.branch, owner: input.owner, repository: input.repository }, async (connection, context) => transport.branches.create(connection, context, input)),
    },
    commits: {
      list: (input: ListCommitsInput, invocation: InvocationInput) => runOperation('github.commit.read', input.connectionId, invocation, { type: 'commit', identifier: input.branch ?? `${input.owner}/${input.repository}`, owner: input.owner, repository: input.repository }, async (connection, context) => transport.commits.list(connection, context, input)),
      get: (input: GetCommitInput, invocation: InvocationInput) => runOperation('github.commit.read', input.connectionId, invocation, { type: 'commit', identifier: input.sha, owner: input.owner, repository: input.repository }, async (connection, context) => transport.commits.get(connection, context, input)),
    },
    issues: {
      list: (input: ListIssuesInput, invocation: InvocationInput) => runOperation('github.issue.read', input.connectionId, invocation, { type: 'issue', identifier: `${input.owner}/${input.repository}`, owner: input.owner, repository: input.repository }, async (connection, context) => transport.issues.list(connection, context, input)),
      get: (input: GetIssueInput, invocation: InvocationInput) => runOperation('github.issue.read', input.connectionId, invocation, { type: 'issue', identifier: String(input.issueNumber), owner: input.owner, repository: input.repository }, async (connection, context) => transport.issues.get(connection, context, input)),
      create: (input: CreateIssueInput, invocation: InvocationInput) => runOperation('github.issue.create', input.connectionId, invocation, { type: 'issue', identifier: input.title, owner: input.owner, repository: input.repository }, async (connection, context) => transport.issues.create(connection, context, input)),
      update: (input: UpdateIssueInput, invocation: InvocationInput) => runOperation('github.issue.update', input.connectionId, invocation, { type: 'issue', identifier: String(input.issueNumber), owner: input.owner, repository: input.repository }, async (connection, context) => transport.issues.update(connection, context, input)),
      comment: (input: CommentIssueInput, invocation: InvocationInput) => runOperation('github.issue.comment', input.connectionId, invocation, { type: 'issue', identifier: String(input.issueNumber), owner: input.owner, repository: input.repository }, async (connection, context) => transport.issues.comment(connection, context, input)),
    },
    pullRequests: {
      list: (input: ListPullRequestsInput, invocation: InvocationInput) => runOperation('github.pull_request.read', input.connectionId, invocation, { type: 'pull_request', identifier: `${input.owner}/${input.repository}`, owner: input.owner, repository: input.repository }, async (connection, context) => transport.pullRequests.list(connection, context, input)),
      get: (input: GetPullRequestInput, invocation: InvocationInput) => runOperation('github.pull_request.read', input.connectionId, invocation, { type: 'pull_request', identifier: String(input.pullNumber), owner: input.owner, repository: input.repository }, async (connection, context) => transport.pullRequests.get(connection, context, input)),
      create: (input: CreatePullRequestInput, invocation: InvocationInput) => runOperation('github.pull_request.create', input.connectionId, invocation, { type: 'pull_request', identifier: input.title, owner: input.owner, repository: input.repository }, async (connection, context) => transport.pullRequests.create(connection, context, input)),
      update: (input: UpdatePullRequestInput, invocation: InvocationInput) => runOperation('github.pull_request.update', input.connectionId, invocation, { type: 'pull_request', identifier: String(input.pullNumber), owner: input.owner, repository: input.repository }, async (connection, context) => transport.pullRequests.update(connection, context, input)),
      comment: (input: CommentPullRequestInput, invocation: InvocationInput) => runOperation('github.pull_request.comment', input.connectionId, invocation, { type: 'pull_request', identifier: String(input.pullNumber), owner: input.owner, repository: input.repository }, async (connection, context) => transport.pullRequests.comment(connection, context, input)),
      review: (input: ReviewPullRequestInput, invocation: InvocationInput) => runOperation('github.pull_request.review', input.connectionId, invocation, { type: 'pull_request', identifier: String(input.pullNumber), owner: input.owner, repository: input.repository }, async (connection, context) => transport.pullRequests.review(connection, context, input)),
      merge: (input: MergePullRequestInput, invocation: InvocationInput) => runOperation('github.pull_request.merge', input.connectionId, invocation, { type: 'pull_request', identifier: String(input.pullNumber), owner: input.owner, repository: input.repository }, async (connection, context) => transport.pullRequests.merge(connection, context, input)),
    },
    async handleWebhook(connectionId: string, rawBody: string, headers: Record<string, string | undefined>) {
      const connection = await loadConnection(state, connectionId);
      const signature = headers['x-hub-signature-256'];
      const secret = await resolveWebhookSecret(connection);
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        throw new InvalidWebhookPayloadError();
      }
      const normalized = normalizeGitHubWebhookEvent(headers, payload);
      const signatureValid = verifyGitHubWebhookSignature(rawBody, signature, secret);
      const deterministicId = `${connectionId}:${String(normalized.deliveryId)}`;
      if (signatureValid) {
        const existing = await state.webhooks.get(deterministicId);
        if (existing) {
          return existing;
        }
      }
      const record = {
        id: signatureValid ? deterministicId : randomUUID(),
        connectionId,
        deliveryId: String(normalized.deliveryId),
        eventName: String(normalized.eventName),
        action: typeof normalized.action === 'string' ? normalized.action : undefined,
        repositoryFullName: typeof normalized.repositoryFullName === 'string' ? normalized.repositoryFullName : undefined,
        signatureValid,
        status: signatureValid ? 'processed' : 'rejected',
        normalizedEvent: normalized,
        receivedAt: now(),
        processedAt: now(),
      } as const;
      try {
        await state.webhooks.insert(record, record.id);
      } catch (error) {
        if (signatureValid) {
          const existing = await state.webhooks.get(deterministicId);
          if (existing) {
            return existing;
          }
        }
        throw error;
      }
      return record;
    },
  };
}
