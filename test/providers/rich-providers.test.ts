import t from 'tap';
import axios from 'axios';
import { httpCache } from '../../src/providers/http';
import doh from 'dohjs';
import tls from 'tls';
import { EventEmitter } from 'events';
import { getRichSuggestions, getGoogleRichSuggestions } from '../../src/rich';

t.test('local suggestion providers', async t => {
  const cases: Array<[string, RegExp]> = [
    ['5 in in cm', /12\.7/], ['100 c in f', /212/],
    ['1730000000', /27 Oct 2024/], ['#f00', /rgb\(255, 0, 0\)/],
    ['isbn 9780306406157', /ISBN 9780306406157/],
    ['urlencode hello world', /hello%20world/], ['base64 encode hello', /aGVsbG8=/],
    ['base64 decode aGVsbG8=', /hello/], ['uuid', /[0-9a-f]{8}-[0-9a-f-]{27}/],
    ['doi 10.1038/nature12373', /doi\.org/], ['arxiv:2103.00001', /arxiv\.org/],
    ['track 12345', /17track/], ['flight UA1', /flightaware/], ['mdn fetch', /developer\.mozilla/],
    ['3pm utc est', /New_York|UTC/], ['time UTC', /UTC/], ['!', /!gh/],
  ];
  for (const [query, expected] of cases) {
    const items = await getRichSuggestions(query);
    t.ok(items.length, query);
    t.match(items.map(item => `${item.title} ${item.annotation} ${item.suggestion}`).join(' '), expected, query);
  }
  for (const query of ['', 'ordinary search', '!npm react', 'isbn 9780306406158', '25pm utc est', 'ssl invalid-domain']) t.same(await getRichSuggestions(query), [], query);
});

t.test('HTTP providers use fixtures and fail independently', async t => {
  const original = axios.defaults.adapter;
  const seen: string[] = [];
  axios.defaults.adapter = async config => {
    const url = config.url!; seen.push(url);
    let data: any;
    let status = 200; let headers: any = {};
    if (url.includes('api.github.com')) data = { full_name: 'alice/project', description: 'A project', stargazers_count: 42 };
    else if (url.includes('registry.npmjs.org')) data = { name: 'react', version: '19.0.0', description: 'UI library' };
    else if (url.includes('rdap.')) data = { ldhName: 'example.com', nameservers: [{ ldhName: 'ns1.example.com' }] };
    else if (url.includes('api.osv.dev')) data = { summary: 'Example vulnerability', details: 'Fixture details' };
    else if (url.includes('frankfurter')) data = { rates: { EUR: 92 }, date: '2026-11-12' };
    else if (url.includes('google.com')) data = JSON.stringify(['hello', ['hello world'], [], [], { 'google:suggesttype': ['QUERY'] }]);
    else if (url === 'https://example.com/start') { status = 302; headers.location = '/end?utm_source=test'; }
    else if (url.includes('example.com/end')) data = '';
    else throw new Error(`Unexpected fixture URL: ${url}`);
    return { data, status, statusText: 'OK', headers, config };
  };
  t.teardown(() => { axios.defaults.adapter = original; });
  for (const [query, expected] of [
    ['gh alice/project', /Stars: 42/], ['npm react', /19\.0\.0/], ['whois example.com', /ns1.example.com/],
    ['rdap example.com', /ns1.example.com/], ['CVE-2021-44228', /Example vulnerability/], ['100 usd eur', /92 EUR/],
    ['https://example.com/start', /1 redirects/],
  ] as const) {
    const items = await getRichSuggestions(query); t.ok(items.length, query);
    t.match(JSON.stringify(items), expected, query);
  }
  const google = await getGoogleRichSuggestions('hello', 'a');
  t.equal(google[0].suggestion, '!a hello world');
  t.ok(seen.some(url => url.includes('client=chrome-omni')));
  const fetched = seen.length;
  await getRichSuggestions('npm react'); await getGoogleRichSuggestions('hello', 'a');
  t.equal(seen.length, fetched, 'repeat lookups are served from the HTTP cache');
  axios.defaults.adapter = async () => { throw new Error('provider down'); }; httpCache.flushAll();
  for (const query of ['gh alice/project', 'npm react', 'whois example.com', 'CVE-2021-44228', '100 usd eur', 'https://example.com/start']) t.same(await getRichSuggestions(query), [], `${query} failure`);
  t.same(await getGoogleRichSuggestions('hello'), []);
});

t.test('TLS and mail providers', async t => {
  const connect = tls.connect;
  const query = doh.DohResolver.prototype.query;
  (tls as any).connect = () => {
    const socket: any = new EventEmitter();
    socket.getPeerCertificate = () => ({ issuer: { CN: 'Fixture CA' }, valid_to: 'Dec 1 2026' });
    socket.end = () => {}; socket.destroy = () => {};
    process.nextTick(() => socket.emit('secureConnect')); return socket;
  };
  (doh.DohResolver.prototype as any).query = async (name, type) => ({ answers: type === 'MX' ? [{ data: 'mail.example.com' }] : [{ data: name.startsWith('_dmarc') ? 'v=DMARC1; p=reject' : name.includes('_domainkey') ? 'v=DKIM1' : 'v=spf1 -all' }] });
  t.teardown(() => { tls.connect = connect; doh.DohResolver.prototype.query = query; });
  t.match((await getRichSuggestions('ssl example.com'))[0].annotation, /Fixture CA/);
  t.match((await getRichSuggestions('mailcheck example.com selector'))[0].annotation, /MX: pass.*SPF: pass.*DMARC: pass.*DKIM \(selector\): pass/);
  (doh.DohResolver.prototype as any).query = async () => { throw new Error('DNS down'); };
  t.same(await getRichSuggestions('mailcheck example.com'), []);
  (tls as any).connect = () => { throw new Error('TLS down'); };
  t.same(await getRichSuggestions('ssl example.com'), []);
});
