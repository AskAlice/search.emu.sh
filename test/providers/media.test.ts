import Fastify from 'fastify';
import suggest from '../../src/routes/suggest';
import search from '../../src/routes/search';
import t from 'tap';
import axios from 'axios';
import { getRichSuggestions } from '../../src/rich';

t.test('movie/TV search uses individual IDs, years and configurable destinations', async t => {
  const names = ['TMDB_API_KEY','TMDB_ACCESS_TOKEN','MOVIE_URL_TEMPLATE','TV_URL_TEMPLATE'];
  const saved = names.map(name => process.env[name]); const adapter = axios.defaults.adapter;
  names.forEach(name => delete process.env[name]);
  t.teardown(() => { names.forEach((name,i) => saved[i] === undefined ? delete process.env[name] : process.env[name] = saved[i]); axios.defaults.adapter = adapter; });
  let count = 0; let request: any;
  axios.defaults.adapter = async config => {
    count++; request = config;
    const tv = config.url!.includes('/tv');
    return { data: { results: [
      { id: 438631, title:'Dune', name:'Severance', release_date:'2021-09-15', first_air_date:'2022-02-18', overview:'A fixture.', poster_path:'/poster.jpg' },
      { id: 841, title:'Dune', name:'Another series', release_date:'1984-12-14', first_air_date:null },
      { id: null, title:'Invalid' },
    ] }, config, headers:{}, status:200, statusText:'OK' };
  };
  t.same(await getRichSuggestions('movie dune'), [], 'no credential means no API call'); t.equal(count,0);
  process.env.TMDB_API_KEY = 'test-key';
  const movies = await getRichSuggestions('movie dune');
  t.equal(movies.length,2); t.equal(movies[0].title, 'Dune (2021)');
  t.equal(movies[0].suggestion, '!redirect https://www.themoviedb.org/movie/438631');
  t.equal(movies[1].suggestion, '!redirect https://www.themoviedb.org/movie/841');
  t.equal(movies[0].image, 'https://image.tmdb.org/t/p/w92/poster.jpg');
  t.equal(new URL(request.url).searchParams.get('api_key'), 'test-key');
  process.env.TMDB_ACCESS_TOKEN = 'test-token';
  process.env.TV_URL_TEMPLATE = 'https://sonarr.example/add/new?term={query}';
  const tv = await getRichSuggestions('TV severance');
  t.equal(tv[0].title, 'Severance (2022)');
  t.equal(tv[1].title, 'Another series', 'missing date does not invent a year');
  t.equal(tv[0].suggestion, '!redirect https://sonarr.example/add/new?term=Severance%20(2022)');
  t.equal(request.headers.Authorization, 'Bearer test-token'); t.notOk(new URL(request.url).searchParams.has('api_key'));
  process.env.MOVIE_URL_TEMPLATE = 'https://radarr.example/add/new?term=tmdb:{id}';
  t.match((await getRichSuggestions('movie dune'))[1].suggestion, /tmdb:841$/);
  process.env.MOVIE_URL_TEMPLATE = 'javascript:alert(1)';
  t.match((await getRichSuggestions('movie dune'))[0].suggestion, /themoviedb.org\/movie\/438631$/);
  const app = Fastify(); await app.register(suggest); await app.register(search);
  try {
    const response = await app.inject('/suggest?type=json&q=movie%20dune');
    t.ok(response.json().some(item => item.suggestion === '!redirect https://www.themoviedb.org/movie/438631'), 'movie provider is wired into autocomplete');
    const redirect = await app.inject('/search?q=movie%20dune');
    t.match(redirect.body, /https:\/\/www.themoviedb.org\/movie\/438631/, 'search opens the matching media result');
  } finally { await app.close(); }
  const fixture = axios.defaults.adapter as (config: any) => Promise<any>;
  axios.defaults.adapter = async config => { const response = await fixture(config); response.data.results[0].title = "Director's cut"; return response; };
  process.env.MOVIE_URL_TEMPLATE = 'https://radarr.example/{title}';
  t.equal((await getRichSuggestions('movie directors cut'))[0].suggestion, '!redirect https://radarr.example/Director%27s%20cut', 'apostrophes are encoded in path substitutions');
  axios.defaults.adapter = async () => { throw new Error('TMDB unavailable'); };
  t.same(await getRichSuggestions('movie dune'), []);
});
