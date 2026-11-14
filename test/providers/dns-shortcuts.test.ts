import t from 'tap';
import Fastify from 'fastify';
import axios from 'axios';
import doh from 'dohjs';
import { parseDnsQuery } from '../../src/providers/dns';
import suggest from '../../src/routes/suggest';

t.test('short domain syntax defaults to A and preserves explicit record types', async t => {
  for (const q of ['example.com', 'dig example.com', 'EXAMPLE.COM a']) t.same(parseDnsQuery(q), { domain:'example.com', type:'A' });
  t.same(parseDnsQuery('example.com mx'), {domain:'example.com', type:'MX'});
  for (const q of ['8.8.8.8','ordinary search','hello','https://example.com','example.com invalid','movie example.com']) t.equal(parseDnsQuery(q), undefined, q);
  const adapter = axios.defaults.adapter, query = doh.DohResolver.prototype.query;
  axios.defaults.adapter = async config => ({ data:JSON.stringify(['q',['google fallback'],[],[],{}]), config, headers:{}, status:200, statusText:'OK' });
  const seen: any[] = [];
  (doh.DohResolver.prototype as any).query = async (name,type) => { seen.push([name,type]); return {answers:[{ name,ttl:60,class:'IN',type,data:type==='MX' ? 'mail.example.com' : 'text-record' }]}; };
  const app=Fastify();await app.register(suggest);
  t.teardown(async()=>{axios.defaults.adapter=adapter;doh.DohResolver.prototype.query=query;await app.close()});
  for (const q of ['example.com','example.com MX','dig example.com TXT']) {
    const items=(await app.inject('/suggest?type=json&q='+encodeURIComponent(q))).json();
    t.match(items[0].suggestion,/toolbox\.googleapps\.com/, 'DNS result ranks above generic autocomplete');
  }
  t.same(seen,[['example.com','A'],['example.com','MX'],['example.com','TXT']]);
});
