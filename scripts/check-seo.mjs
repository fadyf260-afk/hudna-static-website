import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const domain = 'https://hudnaapp.com';
const errors = [];
const text = path => readFile(join(root, path), 'utf8');
const match = (html, pattern) => html.match(pattern)?.[1]?.trim() || '';
const exists = async path => { try { return (await stat(join(root, path))).isFile(); } catch { return false; } };

const sitemap = await text('sitemap.xml');
const urls = [...sitemap.matchAll(/<loc>(https:\/\/hudnaapp\.com\/[^<]*)<\/loc>/g)].map(item => item[1]);
if (!urls.length || new Set(urls).size !== urls.length) errors.push('Sitemap is empty or has duplicate URLs');
for (const url of urls) {
  const pathname = new URL(url).pathname;
  const file = join(pathname.slice(1), 'index.html');
  if (!(await exists(file))) { errors.push(`${url}: missing HTML file`); continue; }
  const html = await text(file);
  const title = match(html, /<title>([^<]+)<\/title>/i);
  const description = match(html, /<meta\s+name="description"\s+content="([^"]+)"/i);
  const canonical = match(html, /<link\s+rel="canonical"\s+href="([^"]+)"/i);
  if (!title) errors.push(`${url}: missing title`);
  if (!description) errors.push(`${url}: missing meta description`);
  if (canonical !== url) errors.push(`${url}: canonical mismatch (${canonical})`);
  if (!/<h1(?:\s|>)/i.test(html)) errors.push(`${url}: missing H1`);
  if (!/<html[^>]+lang="ar"/i.test(html)) errors.push(`${url}: missing Arabic language declaration`);
  if (/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html)) errors.push(`${url}: sitemap includes noindex page`);
  for (const script of html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(script[1]); } catch { errors.push(`${url}: invalid JSON-LD`); }
  }
  const visibleHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  for (const link of visibleHtml.matchAll(/href="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
    const target = link[1];
    const targetFile = target.endsWith('/') ? join(target.slice(1), 'index.html') : target.slice(1);
    if (!(await exists(targetFile))) errors.push(`${url}: broken internal link ${target}`);
  }
}
const admin = await text('admin/index.html');
if (!/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(admin)) errors.push('Admin page must be noindex');
if (!(await text('robots.txt')).includes(`${domain}/sitemap.xml`)) errors.push('robots.txt missing sitemap URL');
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exitCode = 1;
} else console.log(`SEO checks passed for ${urls.length} indexable pages.`);
