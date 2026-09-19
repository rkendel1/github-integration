import { Octokit } from '@octokit/rest';
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
  GitHubTransport,
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

export type TokenResolver = (connection: GitHubConnection, context: CanonicalInvocationContext) => Promise<string>;

function mapOrganization(data: any): GitHubOrganization {
  return { login: data.login, id: data.id, nodeId: data.node_id, url: data.html_url };
}

function mapRepository(data: any): GitHubRepository {
  return {
    id: data.id,
    nodeId: data.node_id,
    owner: data.owner?.login,
    name: data.name,
    fullName: data.full_name,
    private: Boolean(data.private),
    archived: Boolean(data.archived),
    defaultBranch: data.default_branch,
    url: data.html_url,
  };
}

function mapBranch(data: any): GitHubBranch {
  return { name: data.name, sha: data.commit?.sha ?? '', protected: Boolean(data.protected) };
}

function mapCommit(data: any): GitHubCommit {
  return {
    sha: data.sha,
    message: data.commit?.message ?? '',
    author: data.commit?.author?.name,
    committedAt: data.commit?.author?.date,
    url: data.html_url,
  };
}

function mapIssue(data: any): GitHubIssue {
  return { number: data.number, title: data.title, state: data.state, body: data.body ?? undefined, url: data.html_url };
}

function mapPullRequest(data: any): GitHubPullRequest {
  return { number: data.number, title: data.title, state: data.state, body: data.body ?? undefined, merged: data.merged, url: data.html_url };
}

export function createOctokitTransport(resolveToken: TokenResolver): GitHubTransport {
  async function client(connection: GitHubConnection, context: CanonicalInvocationContext): Promise<Octokit> {
    const token = await resolveToken(connection, context);
    return new Octokit({ auth: token });
  }

  return {
    organizations: {
      async list(connection: GitHubConnection, context: CanonicalInvocationContext, _input: ListOrganizationsInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.orgs.listForAuthenticatedUser();
        return response.data.map(mapOrganization);
      },
      async get(connection: GitHubConnection, context: CanonicalInvocationContext, input: GetOrganizationInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.orgs.get({ org: input.organization });
        return mapOrganization(response.data);
      },
    },
    repositories: {
      async list(connection: GitHubConnection, context: CanonicalInvocationContext, input: ListRepositoriesInput) {
        const octokit = await client(connection, context);
        if (input.organization) {
          const response = await octokit.rest.repos.listForOrg({ org: input.organization });
          return response.data.map(mapRepository);
        }
        const response = await octokit.rest.repos.listForAuthenticatedUser();
        return response.data.map(mapRepository);
      },
      async get(connection: GitHubConnection, context: CanonicalInvocationContext, input: GetRepositoryInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.repos.get({ owner: input.owner, repo: input.repository });
        return mapRepository(response.data);
      },
    },
    branches: {
      async list(connection: GitHubConnection, context: CanonicalInvocationContext, input: ListBranchesInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.repos.listBranches({ owner: input.owner, repo: input.repository });
        return response.data.map(mapBranch);
      },
      async get(connection: GitHubConnection, context: CanonicalInvocationContext, input: GetBranchInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.repos.getBranch({ owner: input.owner, repo: input.repository, branch: input.branch });
        return mapBranch(response.data);
      },
      async create(connection: GitHubConnection, context: CanonicalInvocationContext, input: CreateBranchInput) {
        const octokit = await client(connection, context);
        await octokit.rest.git.createRef({ owner: input.owner, repo: input.repository, ref: `refs/heads/${input.branch}`, sha: input.fromSha });
        return { name: input.branch, sha: input.fromSha, protected: false };
      },
    },
    commits: {
      async list(connection: GitHubConnection, context: CanonicalInvocationContext, input: ListCommitsInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.repos.listCommits({ owner: input.owner, repo: input.repository, sha: input.branch });
        return response.data.map(mapCommit);
      },
      async get(connection: GitHubConnection, context: CanonicalInvocationContext, input: GetCommitInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.repos.getCommit({ owner: input.owner, repo: input.repository, ref: input.sha });
        return mapCommit(response.data);
      },
    },
    issues: {
      async list(connection: GitHubConnection, context: CanonicalInvocationContext, input: ListIssuesInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.issues.listForRepo({ owner: input.owner, repo: input.repository, state: input.state });
        return response.data.map(mapIssue);
      },
      async get(connection: GitHubConnection, context: CanonicalInvocationContext, input: GetIssueInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.issues.get({ owner: input.owner, repo: input.repository, issue_number: input.issueNumber });
        return mapIssue(response.data);
      },
      async create(connection: GitHubConnection, context: CanonicalInvocationContext, input: CreateIssueInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.issues.create({ owner: input.owner, repo: input.repository, title: input.title, body: input.body });
        return mapIssue(response.data);
      },
      async update(connection: GitHubConnection, context: CanonicalInvocationContext, input: UpdateIssueInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.issues.update({ owner: input.owner, repo: input.repository, issue_number: input.issueNumber, title: input.title, body: input.body, state: input.state });
        return mapIssue(response.data);
      },
      async comment(connection: GitHubConnection, context: CanonicalInvocationContext, input: CommentIssueInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.issues.createComment({ owner: input.owner, repo: input.repository, issue_number: input.issueNumber, body: input.body });
        return { id: response.data.id, body: response.data.body ?? '' };
      },
    },
    pullRequests: {
      async list(connection: GitHubConnection, context: CanonicalInvocationContext, input: ListPullRequestsInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.pulls.list({ owner: input.owner, repo: input.repository, state: input.state });
        return response.data.map(mapPullRequest);
      },
      async get(connection: GitHubConnection, context: CanonicalInvocationContext, input: GetPullRequestInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.pulls.get({ owner: input.owner, repo: input.repository, pull_number: input.pullNumber });
        return mapPullRequest(response.data);
      },
      async create(connection: GitHubConnection, context: CanonicalInvocationContext, input: CreatePullRequestInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.pulls.create({ owner: input.owner, repo: input.repository, title: input.title, body: input.body, head: input.head, base: input.base });
        return mapPullRequest(response.data);
      },
      async update(connection: GitHubConnection, context: CanonicalInvocationContext, input: UpdatePullRequestInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.pulls.update({ owner: input.owner, repo: input.repository, pull_number: input.pullNumber, title: input.title, body: input.body, state: input.state });
        return mapPullRequest(response.data);
      },
      async comment(connection: GitHubConnection, context: CanonicalInvocationContext, input: CommentPullRequestInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.issues.createComment({ owner: input.owner, repo: input.repository, issue_number: input.pullNumber, body: input.body });
        return { id: response.data.id, body: response.data.body ?? '' };
      },
      async review(connection: GitHubConnection, context: CanonicalInvocationContext, input: ReviewPullRequestInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.pulls.createReview({ owner: input.owner, repo: input.repository, pull_number: input.pullNumber, body: input.body, event: input.event });
        return { id: response.data.id, state: response.data.state ?? input.event };
      },
      async merge(connection: GitHubConnection, context: CanonicalInvocationContext, input: MergePullRequestInput) {
        const octokit = await client(connection, context);
        const response = await octokit.rest.pulls.merge({ owner: input.owner, repo: input.repository, pull_number: input.pullNumber, merge_method: input.method });
        return { merged: response.data.merged, sha: response.data.sha };
      },
    },
  };
}
