import t from 'tap';
import Fastify from 'fastify';
import axios from 'axios';
import * as rich from '../../src/rich';
import suggest from '../../src/routes/suggest';
import img from '../../src/routes/img';
import { omniboxImage, signImage } from '../../src/omnibox-image';
import { EntityInfo } from '../../src/proto/entity_info_pb';
import { httpCache } from '../../src/providers/http';

t.test('omniboxImage keeps same-origin bitmaps and maps everything else to drawable URLs', async t => {
  const host = 'search.emu.sh';
  t.equal(omniboxImage('https://search.emu.sh/icons/github.png', host), 'https://search.emu.sh/icons/github.png');
  t.equal(omniboxImage('/icon/MDN.svg?v=2', host), 'https://search.emu.sh/icons/glyph/MDN.png');
  t.equal(omniboxImage('https://search.emu.sh/icon/COLOR.svg', host), 'https://search.emu.sh/icons/glyph/COLO.png');
  t.equal(omniboxImage('/icon/chromium/equal.svg', host), 'https://search.emu.sh/icons/chromium/equal.png');
  const remote = 'https://cryptocompare.com/media/37746251/btc.png';
  t.equal(omniboxImage(remote, host), `https://search.emu.sh/img?u=${encodeURIComponent(remote)}&s=${signImage(remote)}`);
  t.match(omniboxImage('https://flagcdn.com/us.svg?cache=1', host), /img\?u=https%3A%2F%2Fflagcdn\.com%2Fw80%2Fus\.png%3Fcache%3D1&s=/);
  t.equal(omniboxImage('javascript:alert(1)', host), undefined);
  t.equal(omniboxImage(undefined, host), undefined);
});

t.test('/img serves only signed image URLs', async t => {
  const originalAdapter = axios.defaults.adapter;
  const served: Record<string, [string, string]> = {
    'https://a.test/x.png': ['image/png', 'PNG'],
    'https://a.test/x.svg': ['image/svg+xml', '<svg/>'],
    'https://a.test/page': ['text/html', '<html>'],
  };
  axios.defaults.adapter = async config => {
    const [type, body] = served[config.url!];
    return { data: Buffer.from(body), status: 200, statusText: 'OK', headers: { 'content-type': type }, config } as any;
  };
  const app = Fastify();
  await app.register(img);
  t.teardown(async () => { axios.defaults.adapter = originalAdapter; await app.close(); });
  const get = (u: string, s = signImage(u)) => app.inject(`/img?u=${encodeURIComponent(u)}&s=${s}`);

  const ok = await get('https://a.test/x.png');
  t.equal(ok.statusCode, 200);
  t.equal(ok.headers['content-type'], 'image/png');
  t.match(ok.headers['cache-control'], /s-maxage=604800/);
  t.equal((await get('https://a.test/x.png', 'forged')).statusCode, 403);
  t.equal((await get('https://a.test/x.svg')).statusCode, 415);
  t.equal((await get('https://a.test/page')).statusCode, 415);
});

t.test('chrome output proxies entity images and bang queries keep the bang icon', async t => {
  const originalAdapter = axios.defaults.adapter;
  const originalRich = rich.getRichSuggestions;
  const originalGoogle = rich.getGoogleRichSuggestions;
  httpCache.flushAll();
  axios.defaults.adapter = async () => { throw new Error('provider unavailable'); };
  (rich as any).getRichSuggestions = async () => [];
  const google = new EntityInfo({ name: 'Brad Pitt', annotation: 'Actor', imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=x' });
  (rich as any).getGoogleRichSuggestions = async (query: string, bang?: string) => query === 'brad pitt'
    ? [{ suggestion: 'brad pitt', title: 'Brad Pitt', annotation: 'Actor', type: 'ENTITY', relevance: 1300, entityInfo: Buffer.from(google.toBinary()).toString('base64') }]
    : [{ suggestion: `!${bang} test speed`, title: `!${bang} test speed`, annotation: '', type: 'QUERY', relevance: 1200 }];
  const app = Fastify();
  await app.register(suggest);
  t.teardown(async () => {
    axios.defaults.adapter = originalAdapter;
    (rich as any).getRichSuggestions = originalRich;
    (rich as any).getGoogleRichSuggestions = originalGoogle;
    await app.close();
  });
  const entityImages = (body: string) => {
    const data = JSON.parse(body.replace(/^\)\]\}'\n/, ''));
    return data[1].map((s: string, i: number) => [s, data[4]['google:suggesttype'][i],
      EntityInfo.fromBinary(Buffer.from(data[4]['google:suggestdetail'][i]['google:entityinfo'], 'base64')).imageUrl]);
  };

  const [[, type, image]] = entityImages((await app.inject({ url: '/suggest?client=chrome-omni&q=brad%20pitt', headers: { host: 'search.emu.sh' } })).body);
  t.equal(type, 'ENTITY');
  t.match(image, /^https:\/\/search\.emu\.sh\/img\?u=https%3A%2F%2Fencrypted-tbn0\.gstatic\.com/);

  const rows = entityImages((await app.inject({ url: '/suggest?client=chrome-omni&q=!gh%20test', headers: { host: 'search.emu.sh' } })).body);
  t.same(rows.find(([s]: string[]) => s === '!gh test speed').slice(1), ['ENTITY', 'https://search.emu.sh/icons/github.png']);

  // DuckDuckGo bang: icon comes from the "!a" lookup cached while the bang was typed, with no new request.
  const ddgIcon = 'https://external-content.duckduckgo.com/i/www.amazon.com.ico';
  httpCache.set('https://duckduckgo.com/ac/?q=!a&format=json&pretty=0&no_redirect=1&kl=wt-wt', [{ phrase: '!a', image: ddgIcon }]);
  const amazon = entityImages((await app.inject({ url: '/suggest?client=chrome-omni&q=!a%20test', headers: { host: 'search.emu.sh' } })).body);
  t.same(amazon.find(([s]: string[]) => s === '!a test speed').slice(1), ['ENTITY', omniboxImage(ddgIcon, 'search.emu.sh')]);
});
