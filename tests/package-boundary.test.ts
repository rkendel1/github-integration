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
  assert.equal(packageJson.dependencies['@appport/services'], '0.4.0');
  assert.equal(packageJson.dependencies['@appport/appboundry'], '1.0.10');
  assert.equal(packageJson.dependencies['@appport/sdk'], '1.1.18');
  assert.equal(packageJson.dependencies['pax'], undefined);
  assert.match(docs, /`@appport\/core` was requested/);
  assert.equal(dependencyReport.protocol, 'github-integration/dependency-report/1');
  assert.ok(dependencyReport.packages.some((dependency) => dependency.package === '@appport/sdk' && dependency.published === 'yes'));
});
