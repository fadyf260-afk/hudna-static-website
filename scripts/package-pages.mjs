import { cp, mkdir, rm, writeFile, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = join(root, '.site-dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of ['assets', 'styles', 'admin', 'about', 'blog', 'contact', 'delete-account', 'privacy-policy', 'terms', 'en', 'CNAME', 'index.html', 'robots.txt', 'sitemap.xml', 'feed.xml', 'tracking-config.json']) {
  await cp(join(root, path), join(output, path), { recursive: true });
}
await rm(join(output, 'blog', 'posts.json'));
async function addTracking(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'admin') await addTracking(path);
    } else if (entry.name === 'index.html') {
      const html = await readFile(path, 'utf8');
      if (!html.includes('/assets/tracking.js')) await writeFile(path, html.replace('</head>', '  <script defer src="/assets/tracking.js"></script>\n</head>'));
    }
  }
}
await addTracking(output);
await writeFile(join(output, '.nojekyll'), '');
console.log('Packaged public site without source content, API code, or draft JSON.');
