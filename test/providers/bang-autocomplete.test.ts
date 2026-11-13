import t from 'tap';
import Fastify from 'fastify';
import axios from 'axios';
import suggest from '../../src/routes/suggest';
import search from '../../src/routes/search';

t.test('a query after a bang completes the query rather than the bang name', async t => {
  const adapter = axios.defaults.adapter;
  const calls: string[] = [];
  axios.defaults.adapter = async config => {
    calls.push(config.url!);
    let data: any;
    if (config.url!.includes('google.com')) {
      await new Promise(resolve => setTimeout(resolve, 15));
      data = JSON.stringify(['iphone', ['iphone case', 'iphone charger'], [], [], {}]);
    } else data = config.url!.includes('/ac/') ? [{ phrase: '!arch', snippet: 'Arch Linux', image: 'https://example.com/arch.png' }] : {};
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  const app = Fastify(); await app.register(suggest); await app.register(search);
  t.teardown(async () => { axios.defaults.adapter = adapter; await app.close(); });
  for (const bang of ['a', 'orders', 'o']) {
    calls.length = 0;
    const response = await app.inject('/suggest?type=json&q=' + encodeURIComponent(`!${bang} iphone`));
    const items = response.json();
    t.ok(items.some(item => item.suggestion === `!${bang} iphone case`), `Google completes !${bang}`);
    t.notOk(items.some(item => item.suggestion.startsWith('!arch')), 'no competing bangs');
    t.ok(calls.some(url => url.includes('google.com') && new URL(url).searchParams.get('q') === 'iphone'), 'Google receives only the query');
    t.notOk(calls.some(url => url.includes('duckduckgo')), 'bang discovery is skipped');
  }
  for (const client of ['chrome-omni', 'firefox']) {
    const response = await app.inject('/suggest?client=' + client + '&q=' + encodeURIComponent('!o iphone'));
    const payload = JSON.parse(client === 'firefox' ? response.body : response.body.slice(5));
    t.ok(payload[1].includes('!o iphone case'), `${client} retains query completions`);
    t.notOk(payload[1].some(value => value.startsWith('!arch')), `${client} excludes other bangs`);
  }
  const custom = [{ name: 'shop', aliases: ['s'], url: 'https://example.com/?q=~QUERYHERE~', description: 'My shop' }];
  const personalized = await app.inject({ url: '/suggest?type=json&q=' + encodeURIComponent('!s iphone'), headers: { cookie: 'emu_bangs=' + encodeURIComponent(JSON.stringify(custom)) } });
  t.equal(personalized.json()[0].suggestion, '!s iphone case', 'Google completions rank above the cookie-defined bang fallback');
  calls.length = 0;
  const spaced = await app.inject('/suggest?type=json&q=' + encodeURIComponent('!o '));
  t.ok(spaced.json().every(item => item.suggestion === '!o'), 'first space exits bang-name discovery');
  t.notOk(calls.some(url => url.includes('duckduckgo')), 'no discovery after a trailing space');
  axios.defaults.adapter = async () => { throw new Error('upstream unavailable'); };
  const unavailable = await app.inject('/suggest?type=json&q=' + encodeURIComponent('!o iphone'));
  t.same(unavailable.json().map(item => item.suggestion), ['!o iphone'], 'exact bang remains usable when Google fails');
  const redirect = await app.inject('/search?q=' + encodeURIComponent('!o iphone case'));
  t.match(redirect.headers.location, /search=iphone%20case/, 'completed query retains custom-bang routing');
});
