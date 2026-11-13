import t from 'tap';
import axios from 'axios';
import Fastify from 'fastify';
import { braveSuggestions } from '../../src/providers/brave';
import suggest from '../../src/routes/suggest';
import { EntityInfo } from '../../src/proto/entity_info_pb';

t.test('Brave rich results, bang completions, and failure fallback', async t => {
  const adapter = axios.defaults.adapter, key = process.env.BRAVE_SEARCH_API_KEY;
  delete process.env.BRAVE_SEARCH_API_KEY;
  let calls = 0;
  axios.defaults.adapter = async config => {
    calls++;
    if (new URL(config.url!).hostname === 'api.search.brave.com') {
      t.equal(config.headers['X-Subscription-Token'], 'test-only');
      const url = new URL(config.url!);t.equal(url.searchParams.get('rich'), 'true');
      return { data: { results: [ { query: 'albert einstein', is_entity: true, title:'Albert Einstein', description:'Physicist', img:'https://example.com/einstein.jpg' }, {query:'albert einstein quotes'}, {query:null}, {query:'unsafe image', img:'javascript:alert(1)'} ] }, config, headers:{}, status:200, statusText:'OK' };
    }
    return { data: JSON.stringify(['albert', ['albert einstein','google only'], [], [], {}]), config, headers:{}, status:200, statusText:'OK' };
  };
  const app = Fastify();await app.register(suggest);
  t.teardown(async()=>{axios.defaults.adapter=adapter;if(key===undefined)delete process.env.BRAVE_SEARCH_API_KEY;else process.env.BRAVE_SEARCH_API_KEY=key;await app.close()});
  t.same(await braveSuggestions('albert'),[]);t.equal(calls,0);
  process.env.BRAVE_SEARCH_API_KEY='test-only';
  const results=await braveSuggestions('albert');t.equal(results[0].title,'Albert Einstein');t.equal(results[0].type,'ENTITY');t.equal(results[0].annotation,'Physicist');t.equal(results.length,3);t.equal(results[2].image,undefined);
  const bang=await braveSuggestions('albert','a');t.equal(bang[0].suggestion,'!a albert einstein');
  const json=(await app.inject('/suggest?type=json&q=albert')).json();
  t.equal(json.filter(item=>item.suggestion==='albert einstein').length,1,'duplicate Google query collapses into richer Brave result');
  t.equal(json[0].suggestDetail.i,'https://example.com/einstein.jpg');
  const payload=JSON.parse((await app.inject('/suggest?q=albert&client=chrome-omni')).body.slice(5));
  const entity=EntityInfo.fromBinary(new Uint8Array(Buffer.from(payload[4]['google:suggestdetail'][0]['google:entityinfo'],'base64')));
  t.equal(entity.name,'Albert Einstein');t.equal(entity.annotation,'Physicist');t.equal(entity.imageUrl,'https://example.com/einstein.jpg');
  const before=calls;t.same(await braveSuggestions('x'.repeat(401)),[]);t.equal(calls,before);
  const originalFixture=axios.defaults.adapter as (config:any)=>Promise<any>;
  axios.defaults.adapter=async config=>{if(new URL(config.url!).hostname === 'api.search.brave.com')throw new Error('Brave plan unavailable');return originalFixture(config)};
  t.same(await braveSuggestions('albert'),[]);
  t.ok((await app.inject('/suggest?type=json&q=albert')).json().some(item=>item.suggestion==='google only'),'Google works when Brave fails');
});
