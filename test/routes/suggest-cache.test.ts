import t from 'tap';
import { readFileSync } from 'fs';
import { join } from 'path';
import Fastify from 'fastify';
import axios from 'axios';
import * as rich from '../../src/rich';
import suggest from '../../src/routes/suggest';

const PUBLIC_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

t.test('suggest is edge-cacheable only without emu_bangs and only when it has results', async t => {
  const originalAdapter = axios.defaults.adapter;
  const originalRich = rich.getRichSuggestions;
  const originalGoogle = rich.getGoogleRichSuggestions;
  axios.defaults.adapter = async () => { throw new Error('provider unavailable'); };
  (rich as any).getRichSuggestions = async () => [];
  (rich as any).getGoogleRichSuggestions = async () => [
    { suggestion: 'cached hello', title: 'cached hello', annotation: '', relevance: 1300 },
  ];
  const app = Fastify();
  await app.register(suggest);
  t.teardown(async () => {
    axios.defaults.adapter = originalAdapter;
    (rich as any).getRichSuggestions = originalRich;
    (rich as any).getGoogleRichSuggestions = originalGoogle;
    await app.close();
  });

  const shared = await app.inject('/suggest?client=chrome-omni&q=hello');
  t.equal(shared.statusCode, 200);
  t.equal(shared.headers['cache-control'], PUBLIC_CACHE);
  t.equal(shared.headers.vary, 'x-emu-bangs');

  const custom = await app.inject({
    url: '/suggest?client=chrome-omni&q=hello',
    headers: { cookie: 'emu_bangs=' + encodeURIComponent('[]') },
  });
  t.equal(custom.headers['cache-control'], 'private, no-store');
  t.equal(custom.headers.vary, undefined);

  (rich as any).getGoogleRichSuggestions = async () => [];
  const empty = await app.inject('/suggest?type=json&q=nothing-to-cache');
  t.equal(empty.statusCode, 200);
  t.same(empty.json(), []);
  t.equal(empty.headers['cache-control'], 'private, no-store');

  (rich as any).getGoogleRichSuggestions = async () => [
    { suggestion: 'cached hello', title: 'cached hello', annotation: '', relevance: 1300 },
  ];
  const stamped = await app.inject({
    url: '/suggest?client=chrome-omni&q=hello',
    headers: { 'x-emu-bangs': '1' },
  });
  t.equal(stamped.headers['cache-control'], 'private, no-store');

  const routes = JSON.parse(readFileSync(join(__dirname, '../../vercel.json'), 'utf8')).routes;
  const isolate = routes.find(route => route.has?.some(condition => condition.type === 'cookie' && condition.key === 'emu_bangs'));
  t.ok(isolate, 'cookie requests are marked before the CDN cache lookup');
  t.equal(isolate.transforms?.[0]?.type, 'request.headers');
  t.equal(isolate.transforms?.[0]?.target?.key, 'x-emu-bangs');
  t.equal(isolate.continue, true);
});
