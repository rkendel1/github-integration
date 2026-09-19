import { writeFile } from 'node:fs/promises';
import platformData from '../src/platform-data.json' with { type: 'json' };

const report = {
  generatedAt: new Date().toISOString(),
  protocol: 'github-integration/dependency-report/1',
  packages: platformData.platformAudit.map((entry) => ({
    platform: entry.platform,
    package: entry.packageName,
    version: entry.publishedVersion,
    published: entry.published ? 'yes' : 'no',
    canonicalSource: entry.canonicalSource,
    repositoryVersion: entry.repositoryVersion,
    requiredApi: entry.requiredApi,
    temporaryIntegrationMechanism: entry.temporaryIntegrationMechanism,
  })),
  releasePolicy: {
    failOnMissingPublishedPackageOnlyForReleaseArtifacts: true,
  },
};

if (process.env.RELEASE_ARTIFACT === 'true') {
  const unpublishedRequired = report.packages.filter((entry) => entry.published === 'no' && !['Factory', 'Attn'].includes(entry.platform));
  if (unpublishedRequired.length > 0) {
    console.error('Missing published package(s) for release artifact:', unpublishedRequired.map((entry) => entry.platform).join(', '));
    process.exit(1);
  }
}

await writeFile(new URL('../docs/dependency-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log('wrote docs/dependency-report.json');
