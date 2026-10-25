import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { generate } from './dev-server.mjs';

const root = resolve(import.meta.dirname, '..');
const posts = JSON.parse(await readFile(join(root, 'blog', 'posts.json'), 'utf8'));
await generate(posts);
console.log(`Generated ${posts.filter(post => post.status === 'published').length} published article page(s), blog index, sitemap and RSS.`);
