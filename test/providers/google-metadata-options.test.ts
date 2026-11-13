import t from 'tap';
import Fastify from 'fastify';
import axios from 'axios';
import { EntityInfo, CategoryInfo_Category } from '../../src/proto/entity_info_pb';
import { googleSuggestUrl, parseGoogleSuggestions } from '../../src/rich';
import suggest from '../../src/routes/suggest';

t.test('Google options are allowlisted and cursor position is relative to the forwarded query', async t => {
  const url = new URL(googleSuggestUrl('iphone', { hl: 'fr-CA', gl: 'CA', cp: '9', client: 'firefox', q: 'override', type: 'json', sugkey: 'secret', url: 'https://private.example' }, 3));
  t.equal(url.searchParams.get('hl'), 'fr-CA'); t.equal(url.searchParams.get('gl'), 'CA');
  t.equal(url.searchParams.get('cp'), '6'); t.equal(url.searchParams.get('client'), 'chrome-omni');
  t.equal(url.searchParams.get('q'), 'iphone');
  t.same([...url.searchParams.keys()].sort(), ['client', 'cp', 'gl', 'gs_ri', 'hl', 'q']); t.equal(url.searchParams.get('gs_ri'), 'chrome-ext-ansg', 'Chrome extension marker unlocks entity metadata');
  const invalid = new URL(googleSuggestUrl('test', { hl: ['en'], gl: '../US', cp: '-1' }));
  t.equal(invalid.searchParams.get('hl'), 'en'); t.notOk(invalid.searchParams.has('gl')); t.notOk(invalid.searchParams.has('cp'));
});

t.test('entity data survives JSON, Chrome protobuf and Firefox responses', async t => {
  const entity = new EntityInfo({ entityId: '/m/fixture', name: 'Fixture', annotation: 'An entity', imageUrl: 'https://example.com/fixture.png', dominantColor: '#123456', suggestSearchParameters: 'gs_ssp=fixture', category: [CategoryInfo_Category.MOVIES], websiteUri: 'https://example.com/' });
  const bytes = Buffer.from(entity.toBinary()).toString('base64');
  const raw = JSON.stringify(['fixture', ['fixture'], [], [], { 'google:suggesttype': ['ENTITY'], 'google:suggestsubtypes': [[512, 433]], 'google:suggestdetail': [{ 'google:entityinfo': bytes }] }]);
  const parsed = parseGoogleSuggestions(raw, 'fixture')[0];
  t.same(parsed.subtypes, [512,433]); t.equal(parsed.dominantColor, '#123456');
  const original = axios.defaults.adapter; let requested: URL;
  axios.defaults.adapter = async config => { requested = new URL(config.url!); return { data: raw, config, status:200, statusText:'OK', headers:{} }; };
  const app = Fastify(); await app.register(suggest);
  t.teardown(async () => { axios.defaults.adapter = original; await app.close(); });
  const response = await app.inject('/suggest?type=json&q=!a%20fixture&hl=fr&gl=CA&cp=10&sugkey=never-forward');
  const result = response.json()[0];
  t.equal(requested!.searchParams.get('q'), 'fixture'); t.equal(requested!.searchParams.get('cp'), '7');
  t.equal(requested!.searchParams.get('hl'), 'fr'); t.notOk(requested!.searchParams.has('sugkey'));
  t.equal(result.suggestion, '!a fixture'); t.equal(result.suggestDetail.dc, '#123456');
  t.equal(result.suggestDetail.q, 'gs_ssp=fixture'); t.same(result.suggestDetail.category, [20]);
  t.equal(result.suggestDetail.website, 'https://example.com/');
  const chrome = await app.inject('/suggest?client=chrome-omni&q=fixture');
  const chromePayload = JSON.parse(chrome.body.slice(5));
  t.equal(chromePayload[4]['google:suggestdetail'][0]['google:entityinfo'], bytes, 'original protobuf retained byte for byte');
  t.same(chromePayload[4]['google:suggestsubtypes'][0], [512,433]);
  const firefox = JSON.parse((await app.inject('/suggest?client=firefox&q=fixture')).body);
  t.equal(firefox[3]['google:suggestdetail'][0].dc, '#123456');
});
