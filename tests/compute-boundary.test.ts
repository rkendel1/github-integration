import test from 'node:test';
import assert from 'node:assert/strict';
import type { GitRepositorySource } from '../src/types.js';

/** The provider-neutral shape a future Compute Git source primitive can accept. */
interface ComputeGitSource {
  kind: 'git';
  owner: string;
  repository: string;
  ref: string;
  commit: string;
  source: string;
}

function toComputeGitSource(source: GitRepositorySource): ComputeGitSource {
  const { kind, owner, repository, ref, commit, source: location } = source;
  return { kind, owner, repository, ref, commit, source: location };
}

test('GitHub repository source satisfies a generic Compute source boundary without coupling Compute to GitHub', () => {
  const githubSource: GitRepositorySource = {
    kind: 'git',
    provider: 'github',
    owner: 'acme',
    repository: 'application',
    ref: 'main',
    commit: '0123456789abcdef',
    source: 'https://github.com/acme/application.git',
    private: false,
  };

  const computeSource = toComputeGitSource(githubSource);
  assert.deepEqual(computeSource, {
    kind: 'git',
    owner: 'acme',
    repository: 'application',
    ref: 'main',
    commit: '0123456789abcdef',
    source: 'https://github.com/acme/application.git',
  });
  assert.equal('provider' in computeSource, false);
  assert.equal('credentialReference' in computeSource, false);
});
