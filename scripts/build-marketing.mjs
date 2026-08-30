import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(repoRoot, 'web', 'public');
const output = resolve(repoRoot, 'marketing-dist');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const productPage = await readFile(resolve(source, 'ios.html'), 'utf8');
await writeFile(resolve(output, 'index.html'), productPage);

for (const file of ['privacy.html', 'support.html']) {
  await cp(resolve(source, file), resolve(output, file));
}

await cp(resolve(source, 'ios-assets'), resolve(output, 'ios-assets'), { recursive: true });
