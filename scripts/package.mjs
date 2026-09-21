import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

await mkdir('artifacts', { recursive: true });
const cache = await mkdtemp(path.join(tmpdir(), 'github-integration-npm-cache-'));
try {
  const result = spawnSync('npm', ['pack', '--pack-destination', 'artifacts'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'inherit',
    env: { ...process.env, npm_config_cache: cache },
  });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(cache, { recursive: true, force: true });
}
