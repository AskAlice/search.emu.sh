import t from 'tap';
import Fastify from 'fastify';
import axios from 'axios';
import * as rich from '../../src/rich';
import suggest from '../../src/routes/suggest';
import icons from '../../src/routes/icon';

t.test('discovery icons have pictograms and npm comes from DuckDuckGo', async t => {
  const originalAdapter = axios.defaults.adapter;
  const originalGoogle = rich.getGoogleRichSuggestions;
  const seen: string[] = [];
  axios.defaults.adapter = async config => {
    seen.push(config.url!);
    const data = config.url!.includes('api.duckduckgo.com') ? {} : [
      { phrase: '!npm', snippet: 'npm', image: 'https://example.com/npm.png' },
      { phrase: '!npmd', snippet: 'NPM Direct', image: 'https://example.com/npm.png' },
    ];
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  (rich as any).getGoogleRichSuggestions = async () => [];
  const app = Fastify();
  await app.register(suggest);
  await app.register(icons);
  t.teardown(async () => {
    axios.defaults.adapter = originalAdapter;
    (rich as any).getGoogleRichSuggestions = originalGoogle;
    await app.close();
  });
  const response = await app.inject('/suggest?type=json&q=!np');
  t.equal(response.statusCode, 200);
  const npm = response.json().filter(item => item.suggestion === '!npm');
  t.equal(npm.length, 1, 'only one npm bang result');
  t.ok(npm[0].suggestSubtypes.includes('DuckDuckGo'));
  t.equal(seen.length, 2, 'DuckDuckGo requests run without a local npm registry request');
  for (const name of ['MDN', 'TRK', 'FL', 'RDAP', 'SSL', 'MX']) {
    const icon = await app.inject(`/icon/${name}.svg?v=2`);
    t.equal(icon.statusCode, 200);
    t.match(icon.headers['content-type'], /image\/svg\+xml/);
    t.match(icon.body, /<path/);
    t.notMatch(icon.body, /<text/, `${name} uses a pictogram`);
  }
  t.equal(rich.featureIcon({ suggestion: '!gh owner/repo', title: '!gh', annotation: 'GitHub repository' }), '/icons/github.png');
});
