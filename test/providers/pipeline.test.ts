import t from 'tap';
import Fastify from 'fastify';
import axios from 'axios';
import doh from 'dohjs';
import maxmind from 'maxmind';
import suggest from '../../src/routes/suggest';
import { EntityInfo } from '../../src/proto/entity_info_pb';
import { SuggestTemplateInfo, SuggestTemplateInfo_IconType as Icon } from '../../src/proto/chromium_suggest_pb';

// Each fixture drives the actual provider through the route, with no live calls.
t.test('Google, crypto/cache, DNS, geolocation, bangs, and calculator providers', async t => {
  const adapter = axios.defaults.adapter, query = doh.DohResolver.prototype.query, open = maxmind.open;
  const key = process.env.CRYPTOCOMPARE_KEY;
  process.env.CRYPTOCOMPARE_KEY = 'test-only';
  let prices = 0;
  const template = Buffer.from(new SuggestTemplateInfo({ typeIcon: Icon.TRENDING }).toBinary()).toString('base64');
  axios.defaults.adapter = async config => {
    let data: any;
    if (config.url!.includes('google.com')) data = JSON.stringify(['query', ['google fixture'], [], [], { 'google:suggesttype': ['QUERY'], 'google:suggestdetail': [{ 'google:suggesttemplate': template }] }]);
    else if (config.url!.includes('cryptocompare.com')) { prices++; data = { USD: 20000 }; }
    else if (config.url!.includes('api.duckduckgo.com')) data = {};
    else if (config.url!.includes('duckduckgo.com/ac')) data = [{ phrase: '!npm', snippet: 'npm', image: 'https://example.com/npm.png' }];
    else throw new Error('Unexpected provider');
    return { data, config, status: 200, statusText: 'OK', headers: {} };
  };
  (doh.DohResolver.prototype as any).query = async () => ({ answers: [{ name: 'example.com', ttl: 60, class: 'IN', type: 'TXT', data: 'fixture-record' }] });
  (maxmind as any).open = async () => ({ get: () => ({ city: { names: { en: 'Denver' } }, country: { names: { en: 'United States' }, iso_code: 'US' }, subdivisions: [], location: { latitude: 39.74, longitude: -104.99 } }) });
  const app = Fastify(); await app.register(suggest);
  t.teardown(async () => {
    axios.defaults.adapter = adapter; doh.DohResolver.prototype.query = query; maxmind.open = open;
    if (key === undefined) delete process.env.CRYPTOCOMPARE_KEY; else process.env.CRYPTOCOMPARE_KEY = key;
    await app.close();
  });
  const get = async (q: string) => (await app.inject('/suggest?type=json&q=' + encodeURIComponent(q))).json();
  const google = (await get('ordinary')).find(item => item.suggestion === 'google fixture');
  t.equal(google.suggestDetail.i, 'https://localhost:80/icon/chromium/trending_up.svg');
  t.equal(google.suggestDetail.template, template);
  const btc = (await get('2 btc')).find(item => item.suggestSubtypes.includes('crypto'));
  t.equal(btc.suggestDetail.t, '2 BTC = $40,000.00 USD');
  await get('3 btc'); t.equal(prices, 1, 'crypto price cache is used');
  t.ok((await get('dig example.com TXT')).some(item => item.suggestDetail.t.includes('fixture-record')));
  t.ok((await get('8.8.8.8')).some(item => item.suggestDetail.a.includes('Denver')));
  t.ok((await get('!npm')).some(item => item.suggestSubtypes.includes('DuckDuckGo')));
  t.ok((await get('!orders shoes')).some(item => item.suggestion === '!orders shoes'));
  const calculator = (await get('5 in in cm')).find(item => item.suggestType === 'CALCULATOR');
  t.equal(calculator.suggestDetail.i, 'https://localhost:80/icon/chromium/equal.svg');
  const chrome = await app.inject('/suggest?client=chrome-omni&q=5%20in%20in%20cm');
  const payload = JSON.parse(chrome.body.slice(5));
  const index = payload[4]['google:suggesttype'].indexOf('CALCULATOR');
  const entity = EntityInfo.fromBinary(new Uint8Array(Buffer.from(payload[4]['google:suggestdetail'][index]['google:entityinfo'], 'base64')));
  t.equal(entity.imageUrl, undefined, 'Chrome uses native calculator icon rather than a fetched entity image');
  const ordinaryChrome = await app.inject('/suggest?client=chrome-omni&q=ordinary');
  const ordinaryPayload = JSON.parse(ordinaryChrome.body.slice(5));
  const googleIndex = ordinaryPayload[1].indexOf('google fixture');
  t.equal(ordinaryPayload[4]['google:suggestdetail'][googleIndex]['google:suggesttemplate'], template, 'protobuf is passed intact to Chrome');
  (doh.DohResolver.prototype as any).query = async () => { throw new Error('DNS unavailable'); };
  (maxmind as any).open = async () => { throw new Error('Geo database unavailable'); };
  t.ok((await get('dig example.com TXT')).some(item => item.suggestion === 'google fixture'), 'DNS failure retains Google results');
  t.ok((await get('8.8.8.8')).some(item => item.suggestion === 'google fixture'), 'geolocation failure retains Google results');
});
