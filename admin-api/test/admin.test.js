import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

process.env.SESSION_SECRET = 'test-secret-never-use-in-production-1234567890';
process.env.GITHUB_APP_CLIENT_ID = 'test-client-id';
process.env.GITHUB_APP_CLIENT_SECRET = 'test-client-secret';
const { default: handler } = await import('../api/admin.js');

function response() {
  return {
    headers: {}, statusCode: 200,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
    redirect(code, url) { this.statusCode = code; this.location = url; return this; },
  };
}

test('unauthenticated dashboard cannot read content', async () => {
  const res = response();
  await handler({ method: 'GET', headers: { origin: 'https://hudnaapp.com' }, query: { action: 'content', path: 'blog/posts.json' } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'login_required');
});

test('other origins cannot read content', async () => {
  const res = response();
  await handler({ method: 'GET', headers: { origin: 'https://example.com' }, query: { action: 'content', path: 'blog/posts.json' } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});

test('OAuth login uses PKCE and protected state cookie', async () => {
  const res = response();
  await handler({ method: 'GET', headers: {}, query: { action: 'login' } }, res);
  const url = new URL(res.location);
  assert.equal(res.statusCode, 302);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(url.searchParams.get('state'));
  assert.match(res.headers['set-cookie'], /HttpOnly; Secure; SameSite=Lax/);
});

test('callback rejects forged state', async () => {
  const res = response();
  await handler({ method: 'GET', headers: {}, query: { code: 'fake', state: 'wrong' } }, res);
  assert.equal(res.statusCode, 302);
  assert.match(res.location, /auth=error/);
});

test('only validated article content can be committed', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).endsWith('/login/oauth/access_token')) return { ok: true, json: async () => ({ access_token: 'test-token', expires_in: 28800 }) };
    if (String(url).endsWith('/user')) return { ok: true, json: async () => ({ login: 'fadyf260-afk' }) };
    return { ok: true, status: 200, json: async () => ({ content: { sha: 'new-sha' }, commit: { sha: 'commit-sha' } }) };
  };
  try {
    const login = response();
    await handler({ method: 'GET', headers: {}, query: { action: 'login' } }, login);
    const state = new URL(login.location).searchParams.get('state');
    const auth = response();
    await handler({ method: 'GET', headers: { cookie: login.headers['set-cookie'] }, query: { code: 'test-code', state } }, auth);
    assert.equal(auth.statusCode, 302);
    const sessionCookie = auth.headers['set-cookie'];
    const posts = JSON.parse(await readFile(new URL('../../blog/posts.json', import.meta.url)));
    const request = content => ({
      method: 'PUT', query: { action: 'content', path: 'blog/posts.json' },
      headers: { origin: 'https://hudnaapp.com', cookie: sessionCookie, 'content-type': 'application/json' },
      body: { sha: 'old-sha', content },
    });
    const rejected = response();
    await handler(request([{ ...posts[0], content: '<script>alert(1)</script>' }]), rejected);
    assert.equal(rejected.statusCode, 400);
    const saved = response();
    await handler(request(posts), saved);
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.body.sha, 'new-sha');
    const sent = JSON.parse(requests.at(-1).options.body);
    assert.equal(sent.branch, 'main');
    assert.equal(sent.sha, 'old-sha');
  } finally { globalThis.fetch = originalFetch; }
});
