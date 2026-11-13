import t from 'tap';
import Fastify from 'fastify';
import axios from 'axios';
import suggest from '../../src/routes/suggest';

t.test('local answers do not wait for stalled upstream services', async t => {
  const adapter = axios.defaults.adapter;
  let cancelled = 0;
  axios.defaults.adapter = config => new Promise((_, reject) => {
    const onAbort = () => { cancelled++; reject(new Error('cancelled')); };
    if (config.signal?.aborted) onAbort(); else config.signal?.addEventListener('abort', onAbort, { once: true });
  });
  const app = Fastify(); await app.register(suggest);
  t.teardown(async () => { axios.defaults.adapter = adapter; await app.close(); });
  for (const [q,expected] of [['5 in in cm','12.7'],['!orders','!orders']]) {
    let timer: ReturnType<typeof setTimeout>;
    const response = await Promise.race([
      app.inject('/suggest?type=json&q=' + encodeURIComponent(q)),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 150); }),
    ]);
    clearTimeout(timer!);
    t.ok(response, 'complete before the 150 ms watchdog despite blocked upstreams');
    if (response) t.match(response.body, expected, 'requested answer retained');
  }
  t.ok(cancelled > 0, 'unneeded upstream requests are aborted');
});
