import test from 'node:test';
import assert from 'node:assert/strict';
import type { GitRepositorySource } from '../src/types.js';

/** The provider-neutral shape a future Compute Git source primitive can accept. */
interface ComputeGitSource {
  source: 'git';
  url: string;
  owner: string;
  repository: string;
  ref: string;
  commit: string;
}

function toComputeGitSource(source: GitRepositorySource): ComputeGitSource {
  const { source: kind, url, owner, repository, ref, commit } = source;
  return { source: kind, url, owner, repository, ref, commit };
}

test('GitHub repository source satisfies a generic Compute source boundary without coupling Compute to GitHub', () => {
  const githubSource: GitRepositorySource = {
    source: 'git',
    url: 'https://github.com/acme/application.git',
    owner: 'acme',
    repository: 'application',
    ref: 'main',
    commit: '0123456789abcdef',
  };

  const computeSource = toComputeGitSource(githubSource);
  assert.deepEqual(computeSource, {
    source: 'git',
    url: 'https://github.com/acme/application.git',
    owner: 'acme',
    repository: 'application',
    ref: 'main',
    commit: '0123456789abcdef',
  });
  assert.equal('provider' in computeSource, false);
  assert.equal('private' in computeSource, false);
  assert.equal('credentialReference' in computeSource, false);
});
