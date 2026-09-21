import type {
  CanonicalInvocationContext,
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
  GitHubBranch,
  GitHubCommit,
  GitHubConnection,
  GitHubIssue,
  GitHubOrganization,
  GitHubPullRequest,
  GitHubRepository,
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

/** Internal provider-transport contract. It is deliberately absent from the package exports. */
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
