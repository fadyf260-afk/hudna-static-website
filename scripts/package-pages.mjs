import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = join(root, '.site-dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of ['assets', 'styles', 'admin', 'blog', 'contact', 'delete-account', 'privacy-policy', 'terms', 'CNAME', 'index.html', 'robots.txt', 'sitemap.xml', 'feed.xml']) {
  await cp(join(root, path), join(output, path), { recursive: true });
}
await rm(join(output, 'blog', 'posts.json'));
await writeFile(join(output, '.nojekyll'), '');
console.log('Packaged public site without source content, API code, or draft JSON.');
