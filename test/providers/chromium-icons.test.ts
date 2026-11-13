import t from 'tap';
import Fastify from 'fastify';
import { readFileSync } from 'fs';
import { join } from 'path';
import icons from '../../src/routes/icon';
import { chromiumIcon, decodeSuggestTemplate } from '../../src/chromium/icons';
import { SuggestTemplateInfo, SuggestTemplateInfo_IconType as Icon } from '../../src/proto/chromium_suggest_pb';
import { EntityInfo } from '../../src/proto/entity_info_pb';
import { parseGoogleSuggestions, featureIcon } from '../../src/rich';

t.test('Chromium protobuf enum selects the same rounded icons', async t => {
  const expected = { HISTORY: 'history', NOTES_SPARK: 'notes_spark', SEARCH_LOOP: 'search', SEARCH_LOOP_WITH_SPARKLE: 'search_spark', TRENDING: 'trending_up', SUB_ARROW_RIGHT: 'subdirectory_arrow_right', PROMPT_SUGGESTION: 'prompt_suggestion' };
  for (const [key, value] of Object.entries(Icon)) {
    if (typeof value !== 'number') continue;
    const template = new SuggestTemplateInfo({ typeIcon: value });
    const encoded = Buffer.from(template.toBinary()).toString('base64');
    t.equal(chromiumIcon('QUERY', decodeSuggestTemplate(encoded)), `/icon/chromium/${expected[key] || 'search'}.svg`, key);
  }
  t.equal(chromiumIcon('CALCULATOR'), '/icon/chromium/equal.svg');
  t.equal(chromiumIcon('NAVIGATION'), '/icon/chromium/public.svg');
  t.equal(chromiumIcon('PERSONALIZED_QUERY'), '/icon/chromium/history.svg');
  t.equal(decodeSuggestTemplate('not-a-protobuf'), undefined);
  const app = Fastify(); await app.register(icons); t.teardown(() => app.close());
  for (const name of new Set(['equal', 'public', ...Object.values(expected)])) {
    const response = await app.inject(`/icon/chromium/${name}.svg`);
    t.equal(response.statusCode, 200, name);
    t.equal(response.body, readFileSync(join('src/chromium/icons', name + '.svg'), 'utf8'), 'serves converted Chromium asset');
    t.notMatch(response.body, /<text/, 'no label tile');
  }
  t.equal((await app.inject('/icon/chromium/unknown.svg')).statusCode, 404);
});

t.test('Google Chrome format preserves protobuf metadata and calculator type', async t => {
  const template = new SuggestTemplateInfo({ typeIcon: Icon.TRENDING, primaryText: { text: 'Trending topic' }, secondaryText: { text: 'Popular now' } });
  const encoded = Buffer.from(template.toBinary()).toString('base64');
  const raw = ")]}'\n" + JSON.stringify(['trend', ['trending topic', '12.7'], [], [], { 'google:suggesttype': ['QUERY', 'CALCULATOR'], 'google:suggestdetail': [{ 'google:suggesttemplate': encoded }, {}] }]);
  const items = parseGoogleSuggestions(raw, 'trend');
  t.equal(items[0].title, 'Trending topic'); t.equal(items[0].annotation, 'Popular now');
  t.equal(items[0].suggestTemplate, encoded); t.equal(featureIcon(items[0]), '/icon/chromium/trending_up.svg');
  t.equal(featureIcon(items[1]), '/icon/chromium/equal.svg');
  const entity = new EntityInfo({ name: 'A person', annotation: 'Actor', imageUrl: 'https://example.com/actor.png' });
  const result = parseGoogleSuggestions(JSON.stringify(['actor', ['actor'], [], [], { 'google:suggestdetail': [{ 'google:entityinfo': Buffer.from(entity.toBinary()).toString('base64') }] }]), 'actor');
  t.equal(result[0].title, 'A person'); t.equal(featureIcon(result[0]), 'https://example.com/actor.png');
  t.equal(featureIcon(parseGoogleSuggestions(JSON.stringify(['q', ['person'], [], [], { 'google:suggesttype': ['ENTITY'] }]), 'q')[0]), '/icon/chromium/search.svg', 'Google entities without images use the native fallback');
  t.same(parseGoogleSuggestions('{}', 'query'), []);
  t.throws(() => parseGoogleSuggestions('invalid json', 'query'));
  t.equal(parseGoogleSuggestions(JSON.stringify(['q', ['result'], [], [], { 'google:suggestdetail': [{ 'google:suggesttemplate': 'invalid' }] }]), 'q')[0].suggestTemplate, undefined);
});
