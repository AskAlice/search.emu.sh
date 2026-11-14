import t from 'tap';
import Fastify from 'fastify';
import racing from 'fastify-racing';
import axios from 'axios';
import * as rich from '../../src/rich';
import suggest from '../../src/routes/suggest';

t.test('a stalled rich provider does not block ordinary autocomplete', async t => {
  const originalAdapter = axios.defaults.adapter;
  const originalKey = process.env.CRYPTOCOMPARE_KEY;
  axios.defaults.adapter = async () => { throw new Error("provider unavailable"); };
  const originalRich = rich.getRichSuggestions;
  const originalGoogle = rich.getGoogleRichSuggestions;
  let googleStarted = false;
  (rich as any).getRichSuggestions = () => new Promise(() => {});
  (rich as any).getGoogleRichSuggestions = async () => {
    googleStarted = true;
    return [{ suggestion: 'hello world', title: 'hello world', annotation: '', relevance: 1300 }];
  };
  const app = Fastify();
  await app.register(racing);
  await app.register(suggest);
  t.teardown(async () => {
    axios.defaults.adapter = originalAdapter;
    if (originalKey === undefined) delete process.env.CRYPTOCOMPARE_KEY;
    else process.env.CRYPTOCOMPARE_KEY = originalKey;
    (rich as any).getRichSuggestions = originalRich;
    (rich as any).getGoogleRichSuggestions = originalGoogle;
    await app.close();
  });
  let deadline: ReturnType<typeof setTimeout>;
  const result = await Promise.race([
    app.inject('/suggest?client=chrome-omni&q=hello'),
    new Promise<null>(resolve => { deadline = setTimeout(() => resolve(null), 1500); }),
  ]);
  clearTimeout(deadline!);
  t.ok(result, 'autocomplete completes without another keystroke within 1.5 seconds');
  t.ok(googleStarted, 'Google starts even while rich provider is pending');
  if (result) {
    t.equal(result.statusCode, 200);
    const payload = JSON.parse(result.body.replace(/^\)\]\}'\n/, ''));
    t.equal(payload[0], 'hello');
    t.ok(payload[1].includes('hello world'));
    t.equal(result.headers['cache-control'], 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  }
  (rich as any).getRichSuggestions = async () => [];
  process.env.CRYPTOCOMPARE_KEY = 'test-only';
  const cryptoFailure = await app.inject('/suggest?type=json&q=5%20btc');
  t.equal(cryptoFailure.statusCode, 200);
  t.ok(cryptoFailure.json().some(item => item.suggestion === 'hello world'), 'crypto failure retains successful Google suggestions');

  (rich as any).getGoogleRichSuggestions = () => new Promise(() => {});
  const custom = await app.inject('/suggest?type=json&q=!orders%20shoes');
  t.ok(custom.json().some(item => item.suggestion === '!orders shoes'), 'stalled Google retains local bang without an extra space');
  t.equal((await app.inject('/suggest')).statusCode, 400);
});
