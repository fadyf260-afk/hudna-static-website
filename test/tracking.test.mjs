import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/tracking.js', import.meta.url), 'utf8');

async function run(config, pathname = '/') {
  const scripts = [];
  const elements = [];
  const fields = { '#hudna-analytics': { checked: false }, '#hudna-marketing': { checked: false } };
  const document = {
    head: { append(element) { if (element.src) scripts.push(element.src); } },
    body: { append(element) { elements.push(element); } },
    createElement(tag) {
      return {
        tag,
        setAttribute() {},
        append() {},
        addEventListener(event, listener) { this[event] = listener; },
        querySelector(selector) { return fields[selector]; },
      };
    },
  };
  const context = {
    document, location: { pathname, reload() {} }, localStorage: { getItem() { return null; }, setItem() {} },
    fetch: async () => ({ ok: true, json: async () => config }), window: {}, Date,
  };
  await vm.runInNewContext(source, context);
  const panel = elements.find(element => element.tag === 'section');
  const choose = choice => panel.click({ target: { closest: () => ({ dataset: { choice } }) } });
  return { scripts, choose, fields };
}

test('configured tags wait for consent; rejection sends nothing', async () => {
  const state = await run({ gtmId: 'GTM-ABC1234', ga4Id: 'G-ABC1234', metaPixelId: '12345678901', tiktokPixelId: 'C123456789ABC' });
  assert.deepEqual(state.scripts, []);
  state.choose('reject');
  assert.deepEqual(state.scripts, []);
  state.fields['#hudna-analytics'].checked = true;
  state.choose('save');
  assert.equal(state.scripts.length, 1);
  assert.match(state.scripts[0], /gtag\/js/);
  state.choose('all');
  assert.equal(state.scripts.length, 4);
});

test('marketing tags do not run on article pages', async () => {
  const state = await run({ gtmId: 'GTM-ABC1234', ga4Id: '', metaPixelId: '12345678901', tiktokPixelId: 'C123456789ABC' }, '/blog/example/');
  state.choose('all');
  assert.deepEqual(state.scripts, []);
});
