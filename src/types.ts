import type { SecretReference } from '@appport/services';
import type { AuthProjection } from '@authboundry/core';

export type GitHubCapabilityName =
  | 'github.organization.read'
  | 'github.repository.read'
  | 'github.branch.read'
  | 'github.branch.create'
  | 'github.commit.read'
  | 'github.issue.read'
  | 'github.issue.create'
  | 'github.issue.update'
  | 'github.issue.comment'
  | 'github.pull_request.read'
  | 'github.pull_request.create'
  | 'github.pull_request.update'
  | 'github.pull_request.comment'
  | 'github.pull_request.review'
  | 'github.pull_request.merge';

export interface GitHubConnection {
  id: string;
  tenantId: string;
  applicationId: string;
  environment: string;
  provider: 'github';
  credentialReference: SecretReference;
  webhookSecretReference?: SecretReference;
  authMechanism: 'github_app' | 'oauth_token' | 'personal_access_token';
  status: 'configured' | 'missing' | 'invalid' | 'needs_authorization';
  installationId?: number;
  defaultOwner?: string;
  accountLogin?: string;
  accountType?: string;
  capabilities?: GitHubCapabilityName[];
  createdAt: string;
  updatedAt: string;
}

export interface GitHubInstallation {
  id: string;
  connectionId: string;
  installationId: number;
  accountLogin: string;
  accountType: string;
  targetType: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubOrganization {
  login: string;
  id: number;
  nodeId?: string;
  url?: string;
}

export interface GitHubRepository {
  connectionId?: string;
  id: number;
  nodeId?: string;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  archived: boolean;
  defaultBranch?: string;
  url?: string;
}

export interface GitHubBranch {
  name: string;
  sha: string;
  protected: boolean;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author?: string;
  committedAt?: string;
  url?: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  body?: string;
  url?: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  body?: string;
  merged?: boolean;
  url?: string;
}

export interface GitHubResourceRef {
  type: 'organization' | 'repository' | 'branch' | 'commit' | 'issue' | 'pull_request' | 'webhook';
  owner?: string;
  repository?: string;
  identifier: string;
  nodeId?: string;
  sha?: string;
}

export interface GitHubOperationRecord {
  id: string;
  capability: GitHubCapabilityName;
  principalId: string;
  tenantId: string;
  applicationId: string;
  connectionId: string;
  resourceType?: GitHubResourceRef['type'];
  resourceId?: string;
  status: 'requested' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubEvidenceRecord {
  id: string;
  operationId: string;
  capability: GitHubCapabilityName;
  principalId: string;
  tenantId: string;
  applicationId: string;
  result: 'succeeded' | 'failed';
  githubResource?: GitHubResourceRef;
  timestamp: string;
}

export interface GitHubWebhookEventRecord {
  id: string;
  connectionId?: string;
  deliveryId: string;
  eventName: string;
  action?: string;
  repositoryFullName?: string;
  signatureValid: boolean;
  status: 'received' | 'duplicate' | 'processed' | 'rejected';
  normalizedEvent: Record<string, unknown>;
  receivedAt: string;
  processedAt?: string;
}

export interface InvocationInput {
  applicationId: string;
  claimedPrincipalId?: string;
  claimedTenantId?: string;
}

export interface CanonicalInvocationContext {
  applicationId: string;
  principalId: string;
  tenantId: string;
  capability: GitHubCapabilityName;
  auth: AuthProjection;
}

export interface AuthorityBoundary {
  session(): Promise<AuthProjection>;
  authorize(capability: string): Promise<boolean>;
}

export interface GitHubUiAction {
  id: string;
  label: string;
  capability: GitHubCapabilityName;
  authorized: boolean;
  route: string;
}

export interface GitHubUiSurface {
  id: string;
  label: string;
  route: string;
  actions: GitHubUiAction[];
}

export interface GitHubUiManifest {
  protocol: 'AppPort/ui/1';
  application: {
    id: string;
    name: string;
  };
  navigation: Array<{ id: string; label: string; route: string }>;
  composition: {
    context: readonly ['identity', 'tenant', 'application', 'environment', 'capabilities'];
  };
  configuration: {
    applicationId: string;
    environment?: string;
    status: GitHubConnection['status'];
    requirements: Array<{ id: string; kind: 'connection' | 'credential_reference' | 'webhook'; secret: false }>;
  };
  surfaces: GitHubUiSurface[];
}

export interface ListOrganizationsInput { connectionId: string }
export interface GetOrganizationInput extends ListOrganizationsInput { organization: string }
export interface ListRepositoriesInput { connectionId: string; organization?: string }
export interface GetRepositoryInput { connectionId: string; owner: string; repository: string }
export interface ListBranchesInput extends GetRepositoryInput {}
export interface GetBranchInput extends GetRepositoryInput { branch: string }
export interface CreateBranchInput extends GetBranchInput { fromSha: string }
export interface ListCommitsInput extends GetRepositoryInput { branch?: string }
export interface GetCommitInput extends GetRepositoryInput { sha: string }
export interface ListIssuesInput extends GetRepositoryInput { state?: 'open' | 'closed' | 'all' }
export interface GetIssueInput extends GetRepositoryInput { issueNumber: number }
export interface CreateIssueInput extends GetRepositoryInput { title: string; body?: string }
export interface UpdateIssueInput extends GetIssueInput { title?: string; body?: string; state?: 'open' | 'closed' }
export interface CommentIssueInput extends GetIssueInput { body: string }
export interface ListPullRequestsInput extends GetRepositoryInput { state?: 'open' | 'closed' | 'all' }
export interface GetPullRequestInput extends GetRepositoryInput { pullNumber: number }
export interface CreatePullRequestInput extends GetRepositoryInput { title: string; body?: string; head: string; base: string }
export interface UpdatePullRequestInput extends GetPullRequestInput { title?: string; body?: string; state?: 'open' | 'closed' }
export interface CommentPullRequestInput extends GetPullRequestInput { body: string }
export interface ReviewPullRequestInput extends GetPullRequestInput { body?: string; event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' }
export interface MergePullRequestInput extends GetPullRequestInput { method?: 'merge' | 'squash' | 'rebase' }

export interface GitHubTransport {
  organizations: {
    list(connection: GitHubConnection, context: CanonicalInvocationContext, input: ListOrganizationsInput): Promise<GitHubOrganization[]>;
    get(connection: GitHubConnection, context: CanonicalInvocationContext, input: GetOrganizationInput): Promise<GitHubOrganization>;
  };
  repositories: {
    list(connection: GitHubConnection, context: CanonicalInvocationContext, input: ListRepositoriesInput): Promise<GitHubRepository[]>;
    get(connection: GitHubConnection, context: CanonicalInvocationContext, input: GetRepositoryInput): Promise<GitHubRepository>;
  };
  branches: {
    list(connection: GitHubConnection, context: CanonicalInvocationContext, input: ListBranchesInput): Promise<GitHubBranch[]>;
    get(connection: GitHubConnection, context: CanonicalInvocationContext, input: GetBranchInput): Promise<GitHubBranch>;
    create(connection: GitHubConnection, context: CanonicalInvocationContext, input: CreateBranchInput): Promise<GitHubBranch>;
  };
  commits: {
    list(connection: GitHubConnection, context: CanonicalInvocationContext, input: ListCommitsInput): Promise<GitHubCommit[]>;
    get(connection: GitHubConnection, context: CanonicalInvocationContext, input: GetCommitInput): Promise<GitHubCommit>;
  };
  issues: {
    list(connection: GitHubConnection, context: CanonicalInvocationContext, input: ListIssuesInput): Promise<GitHubIssue[]>;
    get(connection: GitHubConnection, context: CanonicalInvocationContext, input: GetIssueInput): Promise<GitHubIssue>;
    create(connection: GitHubConnection, context: CanonicalInvocationContext, input: CreateIssueInput): Promise<GitHubIssue>;
    update(connection: GitHubConnection, context: CanonicalInvocationContext, input: UpdateIssueInput): Promise<GitHubIssue>;
    comment(connection: GitHubConnection, context: CanonicalInvocationContext, input: CommentIssueInput): Promise<{ id: number; body: string }>;
  };
  pullRequests: {
    list(connection: GitHubConnection, context: CanonicalInvocationContext, input: ListPullRequestsInput): Promise<GitHubPullRequest[]>;
    get(connection: GitHubConnection, context: CanonicalInvocationContext, input: GetPullRequestInput): Promise<GitHubPullRequest>;
    create(connection: GitHubConnection, context: CanonicalInvocationContext, input: CreatePullRequestInput): Promise<GitHubPullRequest>;
    update(connection: GitHubConnection, context: CanonicalInvocationContext, input: UpdatePullRequestInput): Promise<GitHubPullRequest>;
    comment(connection: GitHubConnection, context: CanonicalInvocationContext, input: CommentPullRequestInput): Promise<{ id: number; body: string }>;
    review(connection: GitHubConnection, context: CanonicalInvocationContext, input: ReviewPullRequestInput): Promise<{ id: number; state: string }>;
    merge(connection: GitHubConnection, context: CanonicalInvocationContext, input: MergePullRequestInput): Promise<{ merged: boolean; sha?: string }>;
  };
}
