import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(webRoot, 'dist');

// Vite builds the React web app as dist/index.html. Keep that app available
// under the deliberate secondary /app path, then make the product page the
// canonical root document.
const appHtml = await readFile(resolve(dist, 'index.html'), 'utf8');
await mkdir(resolve(dist, 'app'), { recursive: true });
await writeFile(resolve(dist, 'app', 'index.html'), appHtml);

const productHtml = await readFile(resolve(webRoot, 'public', 'ios.html'), 'utf8');
await writeFile(resolve(dist, 'index.html'), productHtml);
