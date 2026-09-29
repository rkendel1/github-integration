import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createAuthBoundry } from '@authboundry/core';
import type { FeltDBOptions } from '@feltdb/core';
import { createCanonicalInvocationContext } from './auth.js';
import { githubAppPortManifest, mutationCapabilities } from './capabilities.js';
import { createOctokitTransport } from './octokit.js';
import { appBoundryContract } from './platform.js';
import { createGitHubIntegrationState, type GitHubIntegrationState } from './state.js';
import { createUiManifest } from './ui.js';
import { normalizeGitHubWebhookEvent, supportedWebhookEvents, verifyGitHubWebhookSignature } from './webhooks.js';
import type { GitHubTransport } from './transport.js';
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
  GetRepositorySourceInput,
  GitHubCapabilityName,
  GitHubConnection,
  GitHubEvidenceRecord,
  GitHubOperationRecord,
  GitHubPullRequest,
  GitRepositorySource,
  GitHubResourceRef,
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

export type GitHubCapabilityErrorCode =
  | 'INVALID_INPUT'
  | 'REPOSITORY_NOT_FOUND'
  | 'REF_NOT_FOUND'
  | 'AUTHENTICATION_UNAVAILABLE'
  | 'PROVIDER_FAILURE';

export class GitHubCapabilityError extends Error {
  constructor(
    readonly code: GitHubCapabilityErrorCode,
    readonly operation: GitHubCapabilityName,
    readonly context: Readonly<{ owner?: string; repository?: string; ref?: string }>,
  ) {
    super(`${operation} failed: ${code}`);
    this.name = 'GitHubCapabilityError';
  }
}

export interface GitHubIntegrationConfiguration {
  resolveGitHubToken?: (connection: GitHubConnection, context: import('./types.js').CanonicalInvocationContext) => Promise<string>;
  resolveWebhookSecret?: (connection: GitHubConnection) => Promise<string>;
}

export interface GitHubIntegrationOptions {
  authority?: AuthorityBoundary;
  felt?: FeltDBOptions;
  configuration?: GitHubIntegrationConfiguration;
}

interface InternalGitHubIntegrationOptions {
  state?: GitHubIntegrationState;
  transport?: GitHubTransport;
  authority?: AuthorityBoundary;
  resolveGitHubToken?: GitHubIntegrationConfiguration['resolveGitHubToken'];
  resolveWebhookSecret?: (connection: GitHubConnection) => Promise<string>;
}

function now(): string {
  return new Date().toISOString();
}

function providerError(
  error: unknown,
  operation: GitHubCapabilityName,
  context: GitHubCapabilityError['context'],
  notFoundCode: Extract<GitHubCapabilityErrorCode, 'REPOSITORY_NOT_FOUND' | 'REF_NOT_FOUND'>,
): GitHubCapabilityError {
  if (error instanceof GitHubCapabilityError) return error;
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: unknown }).status) : undefined;
  const message = error instanceof Error ? error.message : '';
  if (status === 404) return new GitHubCapabilityError(notFoundCode, operation, context);
  if (status === 401 || status === 403 || message === 'Missing GitHub token resolver.') {
    return new GitHubCapabilityError('AUTHENTICATION_UNAVAILABLE', operation, context);
  }
  return new GitHubCapabilityError('PROVIDER_FAILURE', operation, context);
}

function safeOperationError(error: unknown, operation: GitHubCapabilityName, context: GitHubCapabilityError['context']): GitHubCapabilityError {
  if (error instanceof GitHubCapabilityError) return error;
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: unknown }).status) : undefined;
  const message = error instanceof Error ? error.message : '';
  return new GitHubCapabilityError(
    status === 401 || status === 403 || message === 'Missing GitHub token resolver.' ? 'AUTHENTICATION_UNAVAILABLE' : 'PROVIDER_FAILURE',
    operation,
    context,
  );
}

function validateRepositorySourceInput(input: GetRepositorySourceInput): void {
  const context = { owner: input.owner, repository: input.repository, ref: input.ref };
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(input.owner) || !/^[A-Za-z0-9._-]{1,100}$/.test(input.repository)) {
    throw new GitHubCapabilityError('INVALID_INPUT', 'github.repository.read', context);
  }
  if (input.ref !== undefined && (
    input.ref.length === 0 || input.ref.length > 255 || /[\u0000-\u0020]/.test(input.ref) ||
    [...input.ref].some((character) => '~^:?*[\\'.includes(character)) ||
    input.ref.includes('..') || input.ref.includes('@{') || input.ref.startsWith('.') || input.ref.endsWith('.') ||
    input.ref.endsWith('/') || input.ref.endsWith('.lock')
  )) {
    throw new GitHubCapabilityError('INVALID_INPUT', 'github.repository.read', context);
  }
}

function sanitizeConnection(connection: GitHubConnection): GitHubConnection {
  const sanitizeReference = (reference: GitHubConnection['credentialReference']) => reference ? {
    secretId: reference.secretId,
    tenantId: reference.tenantId,
    ...(reference.provider === undefined ? {} : { provider: reference.provider }),
    ...(reference.accountId === undefined ? {} : { accountId: reference.accountId }),
    ...(reference.kind === undefined ? {} : { kind: reference.kind }),
  } : undefined;
  return {
    id: connection.id,
    tenantId: connection.tenantId,
    applicationId: connection.applicationId,
    environment: connection.environment,
    provider: 'github',
    credentialReference: sanitizeReference(connection.credentialReference),
    webhookSecretReference: sanitizeReference(connection.webhookSecretReference),
    authMechanism: connection.authMechanism,
    status: connection.status,
    installationId: connection.installationId,
    defaultOwner: connection.defaultOwner,
    accountLogin: connection.accountLogin,
    accountType: connection.accountType,
    capabilities: connection.capabilities ? [...connection.capabilities] : undefined,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
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

function buildGitHubIntegration(options: InternalGitHubIntegrationOptions = {}) {
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
    let connection: GitHubConnection;
    try {
      connection = await loadConnection(state, connectionId);
    } catch {
      throw new GitHubCapabilityError('PROVIDER_FAILURE', capability, {
        owner: resource.owner,
        repository: resource.repository,
      });
    }
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
      const safeError = safeOperationError(error, capability, { owner: resource.owner, repository: resource.repository });
      const failed: GitHubOperationRecord = {
        ...operation,
        status: 'failed',
        error: safeError.message,
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
      throw safeError;
    }
  }

  return {
    appBoundryContract,
    manifest() {
      return githubAppPortManifest;
    },
    async flow(): Promise<string> {
      return readFile(new URL('../../feltdb.flow', import.meta.url), 'utf8');
    },
    async upsertConnection(connection: GitHubConnection): Promise<GitHubConnection> {
      if (connection.authMechanism !== 'public' && !connection.credentialReference) {
        throw new Error(`GitHub ${connection.authMechanism} connections require an AppPort credential reference.`);
      }
      const sanitized = sanitizeConnection(connection);
      await state.connections.insert(sanitized, sanitized.id);
      return sanitized;
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
      source: async (input: GetRepositorySourceInput, invocation: InvocationInput): Promise<GitRepositorySource> => {
        validateRepositorySourceInput(input);
        return runOperation(
          'github.repository.read',
          input.connectionId,
          invocation,
          { type: 'repository', identifier: `${input.owner}/${input.repository}`, owner: input.owner, repository: input.repository },
          async (connection, context) => {
            const failureContext = { owner: input.owner, repository: input.repository, ref: input.ref };
            let repository;
            try {
              repository = await transport.repositories.get(connection, context, input);
            } catch (error) {
              throw providerError(error, 'github.repository.read', failureContext, 'REPOSITORY_NOT_FOUND');
            }
            const ref = input.ref ?? repository.defaultBranch;
            if (!ref) throw new GitHubCapabilityError('REF_NOT_FOUND', 'github.repository.read', failureContext);
            let commit;
            try {
              commit = await transport.commits.get(connection, context, { ...input, sha: ref });
            } catch (error) {
              throw providerError(error, 'github.repository.read', { ...failureContext, ref }, 'REF_NOT_FOUND');
            }
            await state.repositories.insert({ ...repository, connectionId: input.connectionId }, `${input.connectionId}:${repository.owner}/${repository.name}`);
            return {
              source: 'git',
              url: `https://github.com/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}.git`,
              owner: repository.owner,
              repository: repository.name,
              ref,
              commit: commit.sha,
            };
          },
        );
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
    webhooks: {
      async handle(connectionId: string, rawBody: string, headers: Record<string, string | undefined>) {
      const connection = await loadConnection(state, connectionId);
      const signature = headers['x-hub-signature-256'];
      let payload: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(rawBody);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Webhook payload must be an object.');
        }
        payload = parsed as Record<string, unknown>;
      } catch {
        throw new InvalidWebhookPayloadError();
      }
      const normalized = normalizeGitHubWebhookEvent(headers, payload);
      if (
        !normalized.deliveryId ||
        !normalized.eventName ||
        !supportedWebhookEvents.has(String(normalized.eventName))
      ) {
        throw new InvalidWebhookPayloadError();
      }
      const secret = await resolveWebhookSecret(connection);
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
    },
  };
}

export type GitHubIntegration = ReturnType<typeof buildGitHubIntegration>;

export function createGitHubIntegration(options: GitHubIntegrationOptions = {}): GitHubIntegration {
  return buildGitHubIntegration({
    authority: options.authority,
    state: createGitHubIntegrationState(options.felt),
    resolveGitHubToken: options.configuration?.resolveGitHubToken,
    resolveWebhookSecret: options.configuration?.resolveWebhookSecret,
  });
}

/** Repository-internal construction seam for deterministic tests. Not exported by the package. */
export function createGitHubIntegrationForTesting(options: InternalGitHubIntegrationOptions): GitHubIntegration {
  return buildGitHubIntegration(options);
}
