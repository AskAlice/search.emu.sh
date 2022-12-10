import axios, { AxiosRequestConfig } from 'axios';
import { FastifyPluginAsync } from 'fastify';
// import zlib from "zlib";
import { Span, Tracer } from '@opentelemetry/api';
import doh from 'dohjs';
import { AbortEvent } from 'fastify-racing';
import http from 'http';
import https from 'https';
import maxmind, { CityResponse } from 'maxmind';
import NodeCache from 'node-cache';
import suggestions from '../suggestions';
import cryptoAssets from '../suggestions/cryptoAssets.json';
const resolver = new doh.DohResolver('https://1.1.1.1/dns-query');
const cache = new NodeCache();
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const sendReply = (request, results, reply) => {
  const suggestType = request?.query?.type === 'json' ? 'suggestType' : 'google:suggesttype';
  const suggestSubtypes = request?.query?.type === 'json' ? 'suggestSubtypes' : 'google:suggestsubtypes';
  const suggestDetail = request?.query?.type === 'json' ? 'suggestDetail' : 'google:suggestdetail';
  const suggestRelevance = request?.query?.type === 'json' ? 'suggestRelevance' : 'google:suggestrelevance';
  const verbatimrelevance = request?.query?.type === 'json' ? 'verbatimrelevance' : 'google:verbatimrelevance';
  const headerTexts = request?.query?.type === 'json' ? 'headerTexts' : 'google:headertexts';
  const clientData = request?.query?.type === 'json' ? 'clientData' : 'google:clientdata';
  const googleRes = {
    [`${suggestType}`]: [],
    [`${headerTexts}`]: [],
    [`${clientData}`]: [],
    [`${suggestSubtypes}`]: [],
    [`${suggestDetail}`]: [],
    [`${suggestRelevance}`]: [],
  };
  results.sort((a, b) => (a.relevance > b.relevance ? -1 : b.relevance > a.relevance ? 1 : 0));
  results.sort((a, b) => (a.relevance > b.relevance ? -1 : b.relevance > a.relevance ? 1 : 0));
  if (request?.query?.type === 'json' || request?.query?.format === 'json') return results;
  const searchFormat: Array<any> = ['', [], [], []];
  searchFormat[0] = request.query.q;
  results.forEach((res) => {
    // const converted = request?.query?.format === 'json' ? res : convert(res);
    Object.entries(res).forEach(([k, v], i) => {
      try {
        k === 'suggestion' ? searchFormat[1].push(v) && searchFormat[2].push('') : googleRes[k].push(v);
      } catch (e) {
        console.log('ERROR AT', k);
      }
    });
  });

  googleRes[verbatimrelevance] = typeof results[0] !== 'undefined' ? results[0][`${suggestRelevance}`] : 555;
  // console.log(googleResType);
  searchFormat.push(googleRes);
  console.log(JSON.stringify(searchFormat));
  return reply
    .code(200)
    .header('Content-disposition', 'attachment; filename=xd.txt')
    .type('text/javascript; charset=UTF-8')
    .send(`)]}'\n${JSON.stringify(searchFormat)}`);
};
const fetchResult = async (signal, request, reply) => {
  const ax = axios.create({
    httpAgent, // httpAgent: httpAgent -> for non es6 syntax
    httpsAgent,
    signal,
  });
  const suggestType = request?.query?.type === 'json' ? 'suggestType' : 'google:suggesttype';
  const suggestSubtypes = request?.query?.type === 'json' ? 'suggestSubtypes' : 'google:suggestsubtypes';
  const suggestDetail = request?.query?.type === 'json' ? 'suggestDetail' : 'google:suggestdetail';
  const suggestRelevance = request?.query?.type === 'json' ? 'suggestRelevance' : 'google:suggestrelevance';
  const verbatimrelevance = request?.query?.type === 'json' ? 'verbatimrelevance' : 'google:verbatimrelevance';
  const headerTexts = request?.query?.type === 'json' ? 'headerTexts' : 'google:headertexts';
  const clientData = request?.query?.type === 'json' ? 'clientData' : 'google:clientdata';
  const {
    activeSpan,
    tracer,
    // context,
    // extract,
    // inject,
  } = request.openTelemetry();
  const t: Tracer = tracer;
  const s: Span = activeSpan;
  s.updateName(`[${request.method}]: /suggest`);
  s.setAttribute('query', request.query.q);
  const childSpan = tracer.startSpan(`${activeSpan.name} - child process`);
  // doSomeWork()

  // Pipe the buffer to the response stream.
  // Spans started in a wrapped route will automatically be children of the activeSpan.
  const lookup = await maxmind.open<CityResponse>('./src/GeoLite2-City.mmdb');

  let useApiKeys: boolean = false; // query param to actually utilize the API keys specified in .env
  if (request.query?.useApiKeys === 'true') {
    useApiKeys = true;
  }
  // console.log(request.headers);
  const searchRegex = request.query?.q?.match(/(?<hasBang>\!?)(?<bang>(?<=\!)[\w\d-_]+)?([\s\+]+)?(?<search>.*)?/);
  const search = searchRegex?.groups?.search;
  // let hasBang = searchRegex.groups.hasBang === '!' ? true : false;
  const q = request.query?.q;
  reply.code(200);
  const bangSlug = searchRegex?.groups.bang;
  const searchingBang = typeof bangSlug === 'string' && typeof search !== 'undefined';
  const googleQuery = searchingBang ? { ...request.query, q: search } : request.query;
  delete googleQuery.useApiKeys; // used internally, don't pass this to google
  let results = [];
  console.log(`search ${search},bangSlug ${bangSlug},googleQuery ${JSON.stringify(googleQuery)}`);
  suggestions.forEach((s) => {
    let shouldPush = false;
    s.aliases.forEach((a) => {
      if (a.startsWith(bangSlug)) shouldPush = true;
    });
    if (shouldPush) {
      results.push({
        suggestion: `!${s.name}${typeof search !== 'undefined' ? ` ${search}` : ''}`,
        [`${suggestType}`]: 'ENTITY',
        [`${suggestSubtypes}`]: ['Custom Bang', 'BANG', s.url.replace(`~QUERYHERE~`, search)],
        [`${suggestDetail}`]: {
          a: s.url.replace(`~QUERYHERE~`, search),
          dc: '#DE5833',
          i: `https://search.emu.sh/icons/${s.favicon}`,
          q: ' ',
          t: `!${s?.name} - ${s?.description}: ${search}`,
        },
        [`${suggestRelevance}`]: 444,
      });
    }
  });
  const cryptoSearch = request.query?.q.trim()?.match(/(?<coef>\d+(?:\.\d+)?)?\s?(?<symbol>.*)?/);
  let assets =
    cryptoSearch?.groups?.symbol?.length > 2
      ? cryptoAssets.filter((a) => a.assetSymbol.toLowerCase() === cryptoSearch?.groups?.symbol?.toLowerCase()).length > 0
        ? cryptoAssets.filter((a) => a.assetSymbol.toLowerCase() === cryptoSearch?.groups?.symbol?.toLowerCase())
        : cryptoAssets.filter(
            (a) =>
              a.assetSymbol.toLowerCase().startsWith(cryptoSearch?.groups?.symbol?.toLowerCase()) ||
              a.assetName.toLowerCase() === cryptoSearch?.groups?.symbol?.toLowerCase() ||
              a.assetSymbol.toLowerCase() === cryptoSearch?.groups?.symbol?.toLowerCase()
          )
      : [];
  console.log(`assets: ${JSON.stringify(assets)}`);
  console.log(JSON.stringify(cryptoSearch));
  const cryptocompareKey = process?.env?.CRYPTOCOMPARE_KEY || false;
  if (assets.length > 0 && useApiKeys && cryptocompareKey) {
    let opt: AxiosRequestConfig = {
      method: 'GET',
      url: `https://min-api.cryptocompare.com/data/price?fsym=${assets[0].assetSymbol}&tsyms=USD&api_key=${cryptocompareKey}`,
      httpsAgent,
      httpAgent,
    };

    const cachedPrice = cache.get(assets[0].assetSymbol);
    let cryptoData: any = { data: { USD: cachedPrice } };
    if (typeof cachedPrice === 'undefined') {
      console.log('price not cached');
      cryptoData = await ax.request(opt);
      cache.set(assets[0].assetSymbol, cryptoData.data.USD, 300);
    } else {
      console.log('price cached');
    }
    const coef = cryptoSearch?.groups?.coef ? cryptoSearch?.groups?.coef : 1;
    console.log(cryptoData?.data?.USD);
    results.push({
      suggestion: `!cmc ${assets[0].assetName.toLowerCase().replace(' ', '-')}`,
      [`${suggestType}`]: 'ENTITY',
      [`${suggestSubtypes}`]: ['crypto'],
      [`${suggestDetail}`]: {
        a: `${assets[0].assetName} - ${assets[0].description}`,
        dc: '#DE5833',
        i: assets[0].image,
        q: '',
        t: `${coef} ${assets[0].assetSymbol} = $${
          coef * cryptoData.data.USD > 0.99
            ? (coef * cryptoData.data.USD)
                .toFixed(2)
                .toString()
                .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
            : `${(coef * cryptoData.data.USD)
                .toString()
                .split('.')[0]
                .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${(coef * cryptoData.data.USD).toString().split('.')[1]}`
        } USD`,
      },
      [`${suggestRelevance}`]: 1999,
    });
  }

  if (results.length > 0) {
    childSpan.end();
    return sendReply(request, results, reply);
  }
  try {
    results = await Promise.any([
      // Dig and ip2location
      new Promise<Array<any>>(async (resolve, reject) => {
        let results = [];
        const isDig = q.match(
          /(dig\s)?(?<domain>(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9])\s(?<DNS>A|AAAA|ALIAS|CNAME|MX|NS|PTR|SOA|SRV|TXT)(\s@)?(?<ns>(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9])?/i
        );
        if (isDig?.length) {
          console.log('MATCHED');
          const response = await resolver.query(isDig.groups.domain, isDig.groups.DNS);

          await Promise.all(
            response.answers.map(async (ans, i) => {
              let answer = ans?.data?.exchange || ans?.data;
              console.log(`answer: ${JSON.stringify(ans)}`);
              let ip = '';
              // IP
              if (
                typeof answer === 'string' &&
                answer?.match(/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/)
              ) {
                ip = answer;
              }
              let geolocation: any = {};
              if (await maxmind.validate(ip)) {
                geolocation = await lookup.get(ip);
              }
              console.log('hmm');
              results.push({
                suggestion: `${`!redirect https://toolbox.googleapps.com/apps/dig/?cache=${i}#${isDig.groups.DNS}/${isDig.groups.domain}`}`,
                [`${suggestType}`]: 'ENTITY',
                [`${suggestSubtypes}`]: [512, 433],
                [`${suggestDetail}`]: {
                  a: `${ans.name} ${ans.ttl} ${ans.class} ${ans.type} ${ans.data?.exchange || ans.data}`,
                  dc: '#DE5833',
                  i:
                    typeof geolocation?.country?.iso_code !== 'undefined'
                      ? `https://cdn.ip2location.com/assets/img/flags/${geolocation?.country?.iso_code?.toLowerCase()}.png?cache=${i}`
                      : `https://emu.bz/gay.png`,
                  q: '',
                  t: `${ans.name} ${ans.ttl} ${ans.class} ${ans.type} ${ans.data?.exchange || ans.data}`,
                },
                [`${suggestRelevance}`]: 512 * (response.answers.length - i),
              });
              console.log(`${results.length} ans: ${JSON.stringify(ans)}\n\nresults:\n${JSON.stringify(results)}`);
              if (results.length) resolve(results);
            })
          );
          console.log(`results: ${JSON.stringify(results)}`);
          console.log(`results.length: ${results.length}`);
        } else {
          if (typeof search === 'string' && maxmind.validate(search?.trim())) {
            const lookup = await maxmind.open<CityResponse>('./src/GeoLite2-City.mmdb');
            const geolocation = await lookup.get(search.trim());
            console.log(`geolocation: ${JSON.stringify(geolocation)}`); // inferred type maxmind.CityResponse
            results.push({
              suggestion: search,
              [`${suggestType}`]: 'ENTITY',
              [`${suggestSubtypes}`]: ['Country'],
              [`${suggestDetail}`]: {
                a: `${geolocation?.city?.names?.en ? `${geolocation?.city?.names?.en}, ` : ''}${
                  geolocation?.subdivisions?.length ? `${geolocation?.subdivisions[0]?.iso_code}, ` : ''
                } ${geolocation?.country?.names?.en} ${(geolocation as any)?.location?.latitude} ${(geolocation as any)?.location?.longitude}`,
                dc: '#DE5833',
                i: `https://cdn.ip2location.com/assets/img/flags/${geolocation?.country?.iso_code?.toLowerCase()}.png`,
                q: 'test',
                t: `${search}`,
              },
              [`${suggestRelevance}`]: 9999,
            });
          }
        }
        if (results.length > 0) resolve(results);
        else reject('no results');
      }),
      //DuckDuckGo bangs
      new Promise<Array<any>>(async (resolve, reject) => {
        if (typeof bangSlug !== 'string' || request.query.q.trim() === '') {
          console.log('rejecting');
          reject();
        } else {
          let results = [];
          const bangRequest: AxiosRequestConfig = {
            url: `https://api.duckduckgo.com/?q=${request.query.q.trim()}&format=json&pretty=0&no_redirect=1`,
          };
          const bangsRequest: AxiosRequestConfig = {
            url: `https://duckduckgo.com/ac/?q=${encodeURIComponent(
              !searchingBang ? request.query.q.trim() : `!${bangSlug}`
            )}&format=json&pretty=0&no_redirect=1&kl=wt-wt`,
          };
          await Promise.all([ax.request(bangRequest), ax.request(bangsRequest)]).then(([{ data: bangs }, { data: bangss }]) => {
            if (bangs?.Redirect) {
              console.log('redirect');
              if (bangs?.Image)
                results.push({
                  suggestion: `${request.query.q}`,
                  [`${suggestType}`]: 'ENTITY',
                  [`${suggestSubtypes}`]: [512, 199, 175],
                  [`${suggestDetail}`]: {
                    a: `${bangs?.Redirect}`,
                    dc: '#DE5833',
                    i: `${bangs?.Image.startsWith('http') ? bangs?.Image : `https://duckduckgo.com/${bangs?.Image}`}`,
                    q: 'redirect',
                    zae: '/g/test',
                    t: `${request.query.q.trim()}`,
                  },
                  [`${suggestRelevance}`]: 900 - results.length,
                });
            }
            // console.log(bangs);

            bangss.forEach((b) => {
              if (!searchingBang) {
                if (b?.image?.length > 0) {
                  // b.image = b.image.substring(0, b.image.indexOf('?'));
                  b.image = b.image += '?cache=' + (Math.random() + 1).toString(36).substring(7);
                  results.push({
                    suggestion: `${b.phrase} ${search ? `${search}` : ''}`,
                    [`${suggestType}`]: 'ENTITY',
                    [`${suggestSubtypes}`]: ['DuckDuckGo'],
                    [`${suggestDetail}`]: {
                      a: b.snippet,
                      dc: '#DE5833',
                      i: b.image,
                      q: 'bang',
                      zae: '/g/test',
                      t: `${b.phrase} - ${typeof b.snippet !== 'undefined' ? ` ${b.snippet}` : ''}`,
                    },
                    [`${suggestRelevance}`]: 6000 - results.length,
                  });
                }
              } else {
                if (b?.phrase === `!${bangSlug}`) {
                  results.push({
                    suggestion: `${request.query.q}`,
                    [`${suggestType}`]: 'ENTITY',
                    [`${suggestSubtypes}`]: ['DuckDuckGo'],
                    [`${suggestDetail}`]: {
                      a: `${bangs?.Redirect}`,
                      dc: '#DE5833',
                      i: b.image,
                      q: 'alice=true',
                      zae: '/g/test',
                      t: `${b.phrase} - ${typeof b.snippet !== 'undefined' ? ` ${b.snippet}` : ''}`,
                    },
                    [`${suggestRelevance}`]: 800 - results.length,
                  });
                }
              }
              console.log('result');
            });
          });
        }
        if (results.length > 0) resolve(results);
        else reject('no results');
      }),
    ]);
    console.log(`results::: ${results}`);
  } catch (e) {
    console.error(e.message);
  }
  if (results.length === 0) {
    results = await new Promise<Array<any>>((resolve, reject) => {
      const options = {
        Method: 'GET',
        url: 'https://www.google.com/complete/search',
        params: googleQuery,
        headers: {
          'x-client-data': 'CJS2yQEIpbbJAQjEtskBCKmdygEIvY7LAQjQmssBCKCgywEI5/HLAQis8ssBCN3yywEI6fLLAQjv98sBCJn4ywEItPjLAQie+csBGI6eywEYuvLLARjf+csB',
          'sec-fetch-site': 'none',
          'sec-fetch-mode': 'no-cors',
          'sec-fetch-dest': 'empty',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'accept-language': 'en-US,en;q=0.9',
          cookie: 'cgic=IgMqLyo',
        },
      };
      ax.request(options)
        .then((res) => {
          let results = [];
          const data = res.data.replace(/.*/, '').substr(1);
          const response = JSON.parse(data);
          response[1].forEach((key, i) => {
            results.push({
              suggestion: searchingBang ? key.replace(new RegExp(`(^)(${bangSlug}\\s)?`, 'g'), `!${bangSlug} ${'$1'}`) : key,
              [`${suggestType}`]: response[4][`google:suggesttype`]?.[i],
              [`${suggestSubtypes}`]: response[4]?.[`google:suggestsubtypes`]?.[i],
              [`${suggestDetail}`]:
                typeof response[4]?.[`google:suggestdetail`]?.[i] !== 'undefined' && searchingBang
                  ? { ...response[4]?.[`google:suggestdetail`]?.[i], a: `${response[4]?.[`google:suggestdetail`]?.[i]['a']} via !${bangSlug}` }
                  : response[4]?.[`google:suggestdetail`]?.[i] || {},
              [`${suggestRelevance}`]: response[4][`google:suggestrelevance`]?.[i],
            });
          });
          if (results.length > 0) {
            resolve(results);
          } else {
            console.log('rejecting google promise');
            reject();
          }
        })
        .catch((error) => {
          console.error(error.message);
          reject(error);
          return;
        });
    });
  }
  childSpan.end();
  reply.code(200);
  return sendReply(request, results, reply);
};
const suggest: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/suggest', async function (request: any, reply) {
    const signal = request.race();
    const result: AbortEvent | unknown = await Promise.race([
      signal,
      new Promise(async (resolve, reject) => {
        let result = '';
        try {
          result = await fetchResult(signal, request, reply);
          resolve(result);
        } catch (e) {
          console.error(e?.message || e);
          result = e?.message || e;
          reject(result);
        }
      }),
    ]);
    if ((<AbortEvent>result)?.type === 'aborted') return 'aborted';
    else return result;
  });
};

export default suggest;
