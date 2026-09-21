import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

test('package uses exact pinned platform dependency versions and documents appport package reality', async () => {
  const packageJson = JSON.parse(await readFile(path.join(process.cwd(), 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
  const docs = await readFile(path.join(process.cwd(), 'docs', 'platform-integration.md'), 'utf8');
  const dependencyReport = JSON.parse(await readFile(path.join(process.cwd(), 'docs', 'dependency-report.json'), 'utf8')) as { protocol: string; packages: Array<{ package: string; published: string }> };

  assert.equal(packageJson.dependencies['@feltdb/core'], '0.11.4');
  assert.equal(packageJson.dependencies['@authboundry/core'], '1.15.1');
  assert.equal(packageJson.dependencies['@appport/services'], '0.4.2');
  assert.equal(packageJson.dependencies['@appport/appboundry'], '1.1.0');
  assert.equal(packageJson.dependencies['@appport/sdk'], '1.1.19');
  assert.equal(packageJson.dependencies['pax'], undefined);
  assert.match(docs, /`@appport\/core` is now published/);
  assert.equal(dependencyReport.protocol, 'github-integration/dependency-report/1');
  assert.ok(dependencyReport.packages.some((dependency) => dependency.package === '@appport/sdk' && dependency.published === 'yes'));
});

test('package exposes only its root and never depends on ecosystem consumers', async () => {
  const packageJson = JSON.parse(await readFile(path.join(process.cwd(), 'package.json'), 'utf8')) as {
    exports: Record<string, unknown>;
    dependencies: Record<string, string>;
    files: string[];
  };

  assert.deepEqual(Object.keys(packageJson.exports), ['.']);
  assert.ok(packageJson.files.includes('.flow'));
  assert.ok(packageJson.files.includes('dist/src'));
  for (const consumer of ['factory', 'software-factory', 'attn', 'pna', 'pax']) {
    assert.equal(packageJson.dependencies[consumer], undefined);
  }
});

test('generated public barrel contains no provider transport or sdk types', async () => {
  const declaration = await readFile(path.join(process.cwd(), 'dist', 'src', 'index.d.ts'), 'utf8');
  assert.doesNotMatch(declaration, /Octokit|RequestError|@octokit|GitHubTransport|transport\.js/);
});
