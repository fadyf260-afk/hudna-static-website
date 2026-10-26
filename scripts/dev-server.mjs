import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rm, stat, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const mime = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon' };
const postsPath = join(root, 'blog', 'posts.json');
const sitePath = join(root, 'site-content.json');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const revision = value => createHash('sha256').update(value).digest('hex');

export async function generateSite(site) {
  const required = ['seoTitle', 'seoDescription', 'heroTitle', 'heroSubtitle', 'primaryCtaText', 'primaryCtaHref', 'howTitle', 'howDescription', 'soonTitle', 'soonDescription'];
  if (required.some(key => typeof site[key] !== 'string' || !site[key].trim())) throw new Error('invalid_site_content');
  if (!/^(#[-a-z0-9]+|\/(?!\/)|https:\/\/)/i.test(site.primaryCtaHref)) throw new Error('invalid_site_url');
  if (!Array.isArray(site.features) || site.features.length !== 5 || site.features.some(feature => !feature.title?.trim() || !feature.description?.trim())) throw new Error('invalid_site_features');
  const template = await readFile(join(root, 'scripts', 'templates', 'home.tpl'), 'utf8');
  const replacements = {
    '{{SEO_TITLE}}': esc(site.seoTitle),
    '{{SEO_DESCRIPTION}}': esc(site.seoDescription),
    '{{HERO_TITLE}}': esc(site.heroTitle),
    '{{HERO_SUBTITLE}}': esc(site.heroSubtitle),
    '{{PRIMARY_CTA_TEXT}}': esc(site.primaryCtaText),
    '{{PRIMARY_CTA_HREF}}': esc(site.primaryCtaHref),
    '{{PRIMARY_CTA_BADGE}}': site.primaryCtaBadge ? ` <span class="pill">${esc(site.primaryCtaBadge)}</span>` : '',
    '{{HOW_TITLE}}': esc(site.howTitle),
    '{{HOW_DESCRIPTION}}': esc(site.howDescription),
    '{{FEATURES}}': site.features.map((feature, index) => `<div class="card feature reveal"><span class="num">${'١٢٣٤٥'[index]}</span><h3>${esc(feature.title)}</h3><p>${esc(feature.description)}</p></div>`).join('\n      '),
    '{{SOON_TITLE}}': esc(site.soonTitle),
    '{{SOON_DESCRIPTION}}': esc(site.soonDescription),
  };
  const published = (await currentPosts()).filter(post => post.status === 'published').sort((a,b) => b.date.localeCompare(a.date)).slice(0, 2);
  replacements['{{FEATURED_POSTS}}'] = published.length ? `<section class="section" aria-labelledby="latest-posts"><div class="wrap"><span class="section-tag">من مدونة هُدنة</span><h2 id="latest-posts">اقرأ على مهلك</h2><p class="lead">مقالات قصيرة تساعدك تلاحظ احتياجاتك ومشاعرك.</p><div class="grid cols-2">${published.map(post => `<article class="card"><span class="section-tag">${esc(post.category)}</span><h3><a href="/blog/${encodeURIComponent(post.slug)}/">${esc(post.title)}</a></h3><p>${esc(post.description)}</p><a href="/blog/${encodeURIComponent(post.slug)}/" aria-label="اقرأ ${esc(post.title)}">اقرأ المقال ←</a></article>`).join('')}</div><p style="margin-top:22px"><a class="btn btn-ghost" href="/blog/">كل المقالات</a></p></div></section>` : '';
  let html = template;
  for (const [marker, value] of Object.entries(replacements)) {
    if (!html.includes(marker)) throw new Error(`missing_template_marker:${marker}`);
    html = html.replaceAll(marker, value);
  }
  await writeFile(join(root, 'index.html'), html, 'utf8');
  await writeFile(sitePath, `${JSON.stringify(site, null, 2)}\n`, 'utf8');
}

async function currentPosts() { return JSON.parse(await readFile(postsPath, 'utf8')); }
function page(post) {
  const canonical = `https://hudnaapp.com/blog/${encodeURIComponent(post.slug)}/`;
  const cover = post.cover?.startsWith('/') ? `https://hudnaapp.com${post.cover}` : (post.cover || 'https://hudnaapp.com/assets/hudna-app-icon-512.png');
  const date = esc(post.date);
  const articleJson = JSON.stringify({ '@context':'https://schema.org','@type':'BlogPosting','mainEntityOfPage':{'@type':'WebPage','@id':canonical},headline:post.title,description:post.description,...(post.cover ? {image:cover} : {}),datePublished:date,dateModified:post.updated || date,inLanguage:'ar',author:{'@type':'Organization',name:'هُدنة'},publisher:{'@type':'Organization',name:'هُدنة',url:'https://hudnaapp.com/'}}).replace(/</g,'\\u003c');
  return `<!doctype html>\n<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(post.title)} | مدونة هُدنة</title><meta name="description" content="${esc(post.description)}"><link rel="canonical" href="${canonical}"><meta name="robots" content="${post.status === 'published' ? 'index,follow,max-image-preview:large' : 'noindex,nofollow'}"><meta property="og:type" content="article"><meta property="og:locale" content="ar_AR"><meta property="og:site_name" content="هُدنة"><meta property="og:title" content="${esc(post.title)}"><meta property="og:description" content="${esc(post.description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${esc(cover)}"><meta property="article:published_time" content="${date}"><meta property="article:modified_time" content="${esc(post.updated || date)}"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#2E7D72"><link rel="icon" href="/assets/favicon.ico" sizes="any"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;700;800;900&display=swap" rel="stylesheet"><link rel="stylesheet" href="/styles/global.css"><link rel="alternate" type="application/rss+xml" title="مدونة هُدنة" href="/feed.xml"><script type="application/ld+json">${articleJson}</script><style>.article{max-width:850px;margin:50px auto;padding:clamp(20px,5vw,54px)}.article h1{color:#0e4d49;font-size:clamp(30px,5vw,48px);line-height:1.35;margin:16px 0}.article-meta{color:var(--text-soft);font-size:14px}.article-body{color:var(--text-soft);font-size:18px;line-height:2}.article-body h2{color:#143f3b;font-size:27px;margin:38px 0 10px}.article-body h3{color:#143f3b}.article-body a{text-decoration:underline}.back-link{font-weight:800}.article-cover{width:100%;max-height:440px;object-fit:cover;border-radius:20px;margin:24px 0}</style></head><body><header class="site-header"><div class="wrap nav"><a class="brand-lockup" href="/" aria-label="هُدنة — الصفحة الرئيسية"><span class="mark"><img src="/assets/hudna-icon.svg" alt="" width="34" height="44"></span><span class="word">هُدنة</span></a><nav class="nav-links"><a href="/">الرئيسية</a><a href="/blog/" class="active">المدونة</a><a href="/privacy-policy/">الخصوصية</a><a href="/contact/">تواصل معنا</a></nav></div></header><main class="wrap"><article class="card article"><a class="back-link" href="/blog/">→ كل المقالات</a><div class="article-meta"><span>${esc(post.category)}</span> · <time datetime="${date}">${date}</time> · ${esc(post.readingTime || 4)} دقائق قراءة</div><h1>${esc(post.title)}</h1><p class="lead">${esc(post.description)}</p>${post.cover ? `<img class="article-cover" src="${esc(post.cover)}" alt="" loading="lazy">` : ''}<div class="article-body">${post.content}</div><p class="hint">المحتوى للتثقيف العام ولا يُعد تشخيصًا أو بديلًا عن استشارة مختص.</p></article></main><footer class="site-footer"><div class="wrap"><div class="footer-top"><span class="name">هُدنة — الأكل العاطفي</span></div><nav class="footer-links"><a href="/blog/">المدونة</a><a href="/privacy-policy/">الخصوصية</a><a href="/terms/">الشروط</a><a href="/contact/">تواصل معنا</a></nav><div class="copyright">© 2026 هُدنة. كل الحقوق محفوظة.</div></div></footer></body></html>`;
}
export async function generate(posts) {
  const published = posts.filter(post => post.status === 'published').sort((a,b) => b.date.localeCompare(a.date));
  for (const post of published) { const directory = join(root,'blog',post.slug); await mkdir(directory,{recursive:true}); await writeFile(join(directory,'index.html'),page(post),'utf8'); }
  const active = new Set(published.map(post => post.slug));
  for (const entry of await readdir(join(root,'blog'),{withFileTypes:true})) { if (entry.isDirectory() && !active.has(entry.name)) await rm(join(root,'blog',entry.name),{recursive:true,force:true}); }
  const template = await readFile(join(root,'scripts','templates','blog-index.tpl'),'utf8');
  const cards = published.length ? published.map(post => `<article class="card post-card"><div class="post-cover" aria-hidden="true">${post.cover ? `<img src="${esc(post.cover)}" alt="" loading="lazy" width="640" height="360" style="width:100%;height:100%;object-fit:cover">` : 'هُدنة'}</div><div class="post-content"><div class="post-meta"><span class="post-category">${esc(post.category)}</span><time datetime="${esc(post.date)}">${esc(post.date)}</time><span>${esc(post.readingTime || 4)} دقائق قراءة</span></div><h2><a href="/blog/${encodeURIComponent(post.slug)}/">${esc(post.title)}</a></h2><p>${esc(post.description)}</p><a class="read-more" href="/blog/${encodeURIComponent(post.slug)}/">اقرأ المقال ←</a></div></article>`).join('') : '<p class="empty-state">لا توجد مقالات منشورة بعد.</p>';
  const placeholder = '<p class="empty-state">جارٍ تحميل المقالات…</p>';
  if (!template.includes(placeholder)) throw new Error('blog_template_missing_placeholder');
  await writeFile(join(root,'blog','index.html'),template.replace(placeholder,cards),'utf8');
  await writeFile(postsPath,`${JSON.stringify(posts,null,2)}\n`,'utf8');
  const urls = ['','privacy-policy/','terms/','delete-account/','contact/','blog/',...published.map(post=>`blog/${post.slug}/`)];
  await writeFile(join(root,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(path=>`  <url><loc>https://hudnaapp.com/${path}</loc>${path.startsWith('blog/') && path !== 'blog/' ? `<lastmod>${esc(posts.find(p=>`blog/${p.slug}/`===path)?.updated || posts.find(p=>`blog/${p.slug}/`===path)?.date)}</lastmod>`:''}</url>`).join('\n')}\n</urlset>\n`,'utf8');
  const now = published.length ? new Date(`${published[0].updated || published[0].date}T12:00:00Z`).toUTCString() : new Date('2000-01-01T12:00:00Z').toUTCString();
  await writeFile(join(root,'feed.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>مدونة هُدنة</title><link>https://hudnaapp.com/blog/</link><description>مقالات هادئة عن الأكل العاطفي والوعي بالمشاعر.</description><language>ar</language><lastBuildDate>${now}</lastBuildDate>${published.map(post=>`<item><title>${esc(post.title)}</title><link>https://hudnaapp.com/blog/${post.slug}/</link><guid>https://hudnaapp.com/blog/${post.slug}/</guid><pubDate>${new Date(`${post.date}T12:00:00Z`).toUTCString()}</pubDate><description>${esc(post.description)}</description><category>${esc(post.category)}</category></item>`).join('')}</channel></rss>\n`,'utf8');
  await generateSite(JSON.parse(await readFile(sitePath, 'utf8')));
}
async function sendFile(response, path) { const info = await stat(path); if (!info.isFile()) throw new Error('not found'); response.writeHead(200,{'Content-Type':mime[extname(path)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}); response.end(await readFile(path)); }
async function body(request) { let raw=''; for await (const chunk of request) { raw += chunk; if (raw.length > 5_000_000) throw new Error('too_large'); } return JSON.parse(raw); }
const server=createServer(async(request,response)=>{
  const url = new URL(request.url,`http://${request.headers.host || `${host}:${port}`}`);
  try {
    if (request.method==='GET' && url.pathname==='/__revision') { response.writeHead(200,{'Content-Type':mime['.json'],'Cache-Control':'no-store'}); response.end(JSON.stringify({revision:revision(await readFile(postsPath,'utf8'))})); return; }
    if (request.method==='GET' && url.pathname==='/__site-revision') { response.writeHead(200,{'Content-Type':mime['.json'],'Cache-Control':'no-store'}); response.end(JSON.stringify({revision:revision(await readFile(sitePath,'utf8'))})); return; }
    if (request.method==='POST' && url.pathname==='/__save-site') { const current=await readFile(sitePath,'utf8'); if(request.headers['x-content-revision']!==revision(current)){response.writeHead(409);response.end('revision_conflict');return;} const data=await body(request); await generateSite(data); response.writeHead(200,{'Content-Type':mime['.json']}); response.end(JSON.stringify({revision:revision(await readFile(sitePath,'utf8'))})); return; }
    if (request.method==='POST' && url.pathname==='/__save-post') { const current=await readFile(postsPath,'utf8'); if(request.headers['x-content-revision']!==revision(current)){response.writeHead(409);response.end('revision_conflict');return;} const data=await body(request); if(!Array.isArray(data.posts)||data.posts.length>500)throw new Error('invalid_posts'); const seen=new Set(); for(const post of data.posts){if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)||seen.has(post.slug))throw new Error('invalid_slug');seen.add(post.slug);post.content=String(post.content||'');if(post.content.length>200000)throw new Error('content_too_large');} await generate(data.posts); response.writeHead(200,{'Content-Type':mime['.json']});response.end(JSON.stringify({revision:revision(await readFile(postsPath,'utf8'))}));return; }
    if(request.method==='POST'&&url.pathname==='/__delete-post'){const current=await readFile(postsPath,'utf8');if(request.headers['x-content-revision']!==revision(current)){response.writeHead(409);response.end('revision_conflict');return;}const data=await body(request);const posts=JSON.parse(current).filter(post=>post.slug!==data.slug);await generate(posts);response.writeHead(200,{'Content-Type':mime['.json']});response.end(JSON.stringify({revision:revision(await readFile(postsPath,'utf8'))}));return;}
    if(request.method!=='GET'&&request.method!=='HEAD'){response.writeHead(405);response.end('Method Not Allowed');return;}
    let pathname=decodeURIComponent(url.pathname); if(pathname==='/')pathname='/index.html'; if(pathname.endsWith('/'))pathname+='index.html'; let path=normalize(join(root,pathname)); if(!path.startsWith(root+sep)&&path!==root)throw new Error('not found'); await sendFile(response,path);
  }catch(error){const status=error.message==='revision_conflict'?409:error.message==='too_large'?413:error.message.startsWith('invalid_')||error.message==='content_too_large'?400:404;response.writeHead(status,{'Content-Type':'text/plain; charset=utf-8'});response.end(error.message==='not found'?'Not Found':error.message);}
});
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) server.listen(port,host,()=>console.log(`Hudna local site and admin: http://${host}:${port}/admin/`));
