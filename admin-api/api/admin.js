import { randomBytes, createHash, createHmac, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';

const paths = new Set(['blog/posts.json', 'site-content.json', 'tracking-config.json']);
const github = 'https://api.github.com';
const base64url = bytes => Buffer.from(bytes).toString('base64url');
const apiOrigin = process.env.API_ORIGIN || 'https://api.hudnaapp.com';
const adminOrigin = process.env.ADMIN_ORIGIN || 'https://hudnaapp.com';
const callback = `${apiOrigin}/api/admin`;
const repo = `${process.env.GITHUB_REPO_OWNER || 'fadyf260-afk'}/${process.env.GITHUB_REPO_NAME || 'hudna-static-website'}`;
const allowedLogin = (process.env.GITHUB_ALLOWED_LOGIN || 'fadyf260-afk').toLowerCase();
const safeArticle = value => sanitizeHtml(value, {
  allowedTags: ['p', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'blockquote', 'a', 'br'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['https'], allowProtocolRelative: false,
});

function key() {
  const secret = process.env.SESSION_SECRET || process.env.GITHUB_APP_CLIENT_SECRET;
  if (!secret || secret.length < 32) throw new Error('A session signing secret of at least 32 characters is required');
  return createHmac('sha256', secret).update('hudna-admin-session-aes-256-gcm-v1').digest();
}

function seal(data) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
  return base64url(Buffer.concat([iv, cipher.getAuthTag(), ciphertext]));
}

function open(value) {
  try {
    const bytes = Buffer.from(value || '', 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
  } catch { return null; }
}

function cookie(req, name) {
  const part = (req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`));
  return part?.slice(name.length + 1) || '';
}

function setCookie(res, name, value, maxAge) {
  res.setHeader('Set-Cookie', `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/api/admin; Max-Age=${maxAge}`);
}

function json(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

function session(req) {
  const data = open(cookie(req, 'hudna_session'));
  return data?.exp > Date.now() && data.login?.toLowerCase() === allowedLogin ? data : null;
}

async function githubRequest(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...options.headers },
  });
  return response;
}

export function validate(path, content) {
  if (path === 'tracking-config.json') {
    const patterns = {
      gtmId: /^(?:|GTM-[A-Z0-9]{4,20})$/,
      ga4Id: /^(?:|G-[A-Z0-9]{4,20})$/,
      metaPixelId: /^(?:|[0-9]{5,30})$/,
      tiktokPixelId: /^(?:|[A-Z0-9]{8,40})$/,
    };
    return content && typeof content === 'object' && !Array.isArray(content) &&
      Object.keys(content).length === Object.keys(patterns).length &&
      Object.entries(patterns).every(([field, pattern]) => typeof content[field] === 'string' && pattern.test(content[field]));
  }
  if (path === 'blog/posts.json') {
    if (!Array.isArray(content) || content.length > 500) return false;
    const slugs = new Set();
    for (const post of content) {
      if (!post || typeof post !== 'object' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug || '') || slugs.has(post.slug)) return false;
      slugs.add(post.slug);
      for (const field of ['title', 'description', 'category', 'date', 'content']) if (typeof post[field] !== 'string' || !post[field].trim()) return false;
      if (!['draft', 'published'].includes(post.status) || !Array.isArray(post.tags) || post.tags.some(tag => typeof tag !== 'string')) return false;
      if (post.title.length > 100 || post.description.length > 170 || post.content.length > 100000 || !/^\d{4}-\d{2}-\d{2}$/.test(post.date)) return false;
      if (safeArticle(post.content).replaceAll('<br />', '<br>') !== post.content) return false;
      if (post.en != null) {
        if (typeof post.en !== 'object' || Array.isArray(post.en)) return false;
        for (const field of ['title','description','category','content']) if (typeof post.en[field] !== 'string' || !post.en[field].trim()) return false;
        if (post.en.title.length > 100 || post.en.description.length > 170 || post.en.content.length > 100000) return false;
        if (safeArticle(post.en.content).replaceAll('<br />','<br>') !== post.en.content) return false;
      }
      if (typeof post.cover !== 'string' || (post.cover && !/^(https:\/\/|\/(?!\/))/.test(post.cover))) return false;
    }
    return true;
  }
  if (!content || Array.isArray(content) || typeof content !== 'object') return false;
  const fields = ['seoTitle', 'seoDescription', 'heroTitle', 'heroSubtitle', 'primaryCtaText', 'primaryCtaHref', 'primaryCtaBadge', 'howTitle', 'howDescription', 'soonTitle', 'soonDescription'];
  for (const version of [content, content.en]) {
    if (!version || typeof version !== 'object' || Array.isArray(version)) return false;
    if (fields.some(field => typeof version[field] !== 'string' || version[field].length > 2000)) return false;
    if (fields.filter(field => field !== 'primaryCtaBadge').some(field => !version[field].trim())) return false;
    if (!Array.isArray(version.features) || version.features.length !== 5 || version.features.some(feature => typeof feature.title !== 'string' || !feature.title.trim() || typeof feature.description !== 'string' || !feature.description.trim())) return false;
    if (!/^(#[-a-z0-9]+|\/(?!\/)|https:\/\/)/i.test(version.primaryCtaHref)) return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (!((process.env.SESSION_SECRET || process.env.GITHUB_APP_CLIENT_SECRET)?.length >= 32)) {
    return res.status(503).json({ error: 'session_secret_not_configured' });
  }
  try {
    const origin = req.headers.origin;
    if (origin === adminOrigin) {
      res.setHeader('Access-Control-Allow-Origin', adminOrigin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') {
      if (origin !== adminOrigin) return res.status(403).end();
      res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(204).end();
    }
    const action = req.query.action || (req.query.code || req.query.error ? 'callback' : '');
    if (req.method === 'GET' && action === 'login') {
      if (!process.env.GITHUB_APP_CLIENT_ID || !process.env.GITHUB_APP_CLIENT_SECRET) return json(res, 503, { error: 'github_app_not_configured' });
      const state = base64url(randomBytes(24));
      const verifier = base64url(randomBytes(32));
      const challenge = base64url(createHash('sha256').update(verifier).digest());
      setCookie(res, 'hudna_oauth', seal({ state, verifier, exp: Date.now() + 600000 }), 600);
      const url = new URL('https://github.com/login/oauth/authorize');
      url.searchParams.set('client_id', process.env.GITHUB_APP_CLIENT_ID);
      url.searchParams.set('redirect_uri', callback);
      url.searchParams.set('state', state);
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('code_challenge_method', 'S256');
      return res.redirect(302, url.toString());
    }
    if (req.method === 'GET' && action === 'callback') {
      const attempt = open(cookie(req, 'hudna_oauth'));
      setCookie(res, 'hudna_oauth', '', 0);
      const received = Buffer.from(String(req.query.state || ''));
      const expected = Buffer.from(attempt?.state || '');
      if (!attempt || attempt.exp < Date.now() || received.length !== expected.length || !timingSafeEqual(received, expected) || !req.query.code) return res.redirect(302, `${adminOrigin}/admin/?auth=error`);
      const exchange = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: process.env.GITHUB_APP_CLIENT_ID, client_secret: process.env.GITHUB_APP_CLIENT_SECRET, code: req.query.code, redirect_uri: callback, code_verifier: attempt.verifier }),
      });
      const tokenData = await exchange.json();
      if (!exchange.ok || !tokenData.access_token) return res.redirect(302, `${adminOrigin}/admin/?auth=error`);
      const userResponse = await githubRequest(`${github}/user`, tokenData.access_token);
      const user = await userResponse.json();
      if (!userResponse.ok || user.login?.toLowerCase() !== allowedLogin) return res.redirect(302, `${adminOrigin}/admin/?auth=denied`);
      const seconds = Math.min(Number(tokenData.expires_in) || 28800, 28800);
      setCookie(res, 'hudna_session', seal({ token: tokenData.access_token, login: user.login, exp: Date.now() + seconds * 1000 }), seconds);
      return res.redirect(302, `${adminOrigin}/admin/`);
    }
    if (req.method === 'GET' && action === 'session') {
      const current = session(req);
      return json(res, 200, { authenticated: Boolean(current), login: current?.login || null });
    }
    if (req.method === 'POST' && action === 'logout') {
      if (origin !== adminOrigin) return json(res, 403, { error: 'forbidden_origin' });
      setCookie(res, 'hudna_session', '', 0);
      return json(res, 200, { ok: true });
    }
    if (action !== 'content' || !['GET', 'PUT'].includes(req.method)) return json(res, 404, { error: 'not_found' });
    if (origin !== adminOrigin) return json(res, 403, { error: 'forbidden_origin' });
    const current = session(req);
    if (!current) return json(res, 401, { error: 'login_required' });
    const path = String(req.query.path || '');
    if (!paths.has(path)) return json(res, 400, { error: 'invalid_path' });
    const url = `${github}/repos/${repo}/contents/${path}`;
    if (req.method === 'GET') {
      const response = await githubRequest(url, current.token);
      if (!response.ok) return json(res, response.status, { error: 'github_read_failed' });
      const file = await response.json();
      return json(res, 200, { content: JSON.parse(Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString()), sha: file.sha });
    }
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: 'json_required' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || typeof body.sha !== 'string' || !validate(path, body.content) || JSON.stringify(body).length > 1200000) return json(res, 400, { error: 'invalid_content' });
    const bytes = Buffer.from(`${JSON.stringify(body.content, null, 2)}\n`);
    const response = await githubRequest(url, current.token, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: path === 'blog/posts.json' ? 'content: update blog posts from dashboard' : path === 'tracking-config.json' ? 'content: update tracking IDs from dashboard' : 'content: update homepage from dashboard', content: bytes.toString('base64'), sha: body.sha, branch: 'main' }),
    });
    if (response.status === 409) return json(res, 409, { error: 'revision_conflict' });
    if (!response.ok) return json(res, response.status, { error: 'github_write_failed' });
    const result = await response.json();
    return json(res, 200, { sha: result.content.sha, commit: result.commit.sha });
  } catch (error) {
    console.error('Admin API error:', error);
    return json(res, 500, { error: 'server_error' });
  }
}
