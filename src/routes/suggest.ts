import { FastifyPluginAsync } from 'fastify';
import axios, { AxiosRequestConfig } from 'axios';
// import zlib from "zlib";
import suggestions from '../suggestions';
import cryptoAssets from '../suggestions/cryptoAssets.json';
import maxmind, { CityResponse } from 'maxmind';
import dig from 'node-dig-dns';
import NodeCache from 'node-cache';
const cache = new NodeCache();
const suggest: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/suggest', async function (request: any, reply) {
    let useApiKeys: boolean = false; // query param to actually utilize the API keys specified in .env
    if (request.query?.useApiKeys === 'true') {
      useApiKeys = true;
    }
    // console.log(request.headers);
    const searchRegex = request.query?.q?.match(/(?<hasBang>\!?)(?<bang>(?<=\!)[\w\d-_]+)?([\s\+]+)?(?<search>.*)?/);
    const search = searchRegex?.groups.search;
    const q = request.query?.q;
    const bangSlug = searchRegex?.groups.bang;
    const searchingBang = typeof bangSlug === 'string' && typeof search !== 'undefined';
    const googleQuery = searchingBang ? { ...request.query, q: search } : request.query;
    delete googleQuery.useApiKeys; // used internally, don't pass this to google
    console.log('hi');
    console.log(`search ${search},bangSlug ${bangSlug},googleQuery ${JSON.stringify(googleQuery)}`);
    const cryptoSearch = request.query?.q?.match(/(?<coef>\d+(?:\.\d+)?)?\s?(?<symbol>.*)?/);
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
    var options: AxiosRequestConfig = {
      method: 'GET',
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
    const data = googleQuery?.client ? (await axios.request(options)).data.replace(/.*/, '').substr(1) : '[[],[],[]]';
    // const data = `[1,[]]`;
    // console.log(data);
    const response = JSON.parse(data);
    // console.log(`data: ${JSON.stringify(data, null, 2)}`);
    // console.log(`response: ${JSON.stringify(response, null, 2)}`);
    const suggestType = request?.query?.type === 'json' ? 'suggestType' : 'google:suggesttype';
    const suggestSubtypes = request?.query?.type === 'json' ? 'suggestSubtypes' : 'google:suggestsubtypes';
    const suggestDetail = request?.query?.type === 'json' ? 'suggestDetail' : 'google:suggestdetail';
    const suggestRelevance = request?.query?.type === 'json' ? 'suggestRelevance' : 'google:suggestrelevance';
    const results = [];
    const cryptocompareKey = process?.env?.CRYPTOCOMPARE_KEY || false;
    if (assets.length > 0 && useApiKeys && cryptocompareKey) {
      let opt: AxiosRequestConfig = {
        method: 'GET',
        url: `https://min-api.cryptocompare.com/data/price?fsym=${assets[0].assetSymbol}&tsyms=USD&api_key=${cryptocompareKey}`,
      };

      console.log(JSON.stringify(opt));
      const cachedPrice = cache.get(assets[0].assetSymbol);
      let cryptoData: any = { data: { USD: cachedPrice } };
      if (typeof cachedPrice === 'undefined') {
        console.log('price not cached');
        cryptoData = await axios.request(opt);
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
        [`${suggestRelevance}`]: 99999,
      });
    }

    const isDig = q.match(
      /(?<domain>(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9])\s(?<DNS>A|AAAA|ALIAS|CNAME|MX|NS|PTR|SOA|SRV|TXT)/i
    );
    if (isDig?.length) {
      console.log('MATCHED');
      const d = await dig([isDig.groups.domain, isDig.groups.DNS]);
      console.log(d);
      let geolocation: any = '';
      if (d?.answer && d?.answer[0] && d?.answer[0]?.value && maxmind.validate(d?.answer[0].value)) {
        const lookup = await maxmind.open<CityResponse>('./src/GeoLite2-City.mmdb');
        geolocation = lookup.get(d.answer[0].value);
        console.log(geolocation);
      }
      let values = [];
      d.answer.forEach((a) => {
        if (typeof a.value === 'string') {
          values.push(a?.value);
        } else {
          if (a?.value?.server) values.push(a?.value?.server);
          if (a?.value?.domain) values.push(a?.value?.domain);
        }
      });
      let detail = {
        ansa: {
          l: [
            {
              il: {
                at: {
                  t: values.join(', '),
                  tt: 19,
                },
                t: [
                  {
                    t: 'spy stock',
                    tt: 8,
                  },
                ],
              },
            },
            {
              il: {
                at: {
                  t: d.header.join(' ').replace(/[^a-zA-Z0-9\.\<\> ]/g, ''),
                  tt: 6,
                },
                t: [
                  {
                    t: ' ',
                    tt: 18,
                  },
                ],
              },
            },
          ],
        },
        ansb: '10',
        ansc: '1629540082734',
      };
      results.push({
        suggestion: search,
        [`${suggestType}`]: 'ENTITY',
        [`${suggestSubtypes}`]: ['Country'],
        [`${suggestDetail}`]: detail,
        [`${suggestRelevance}`]: 99999,
      });
    }
    if (maxmind.validate(search)) {
      const lookup = await maxmind.open<CityResponse>('./src/GeoLite2-City.mmdb');
      const geolocation = lookup.get(search);
      console.log(geolocation); // inferred type maxmind.CityResponse
      results.push({
        suggestion: search,
        [`${suggestType}`]: 'ENTITY',
        [`${suggestSubtypes}`]: ['Country'],
        [`${suggestDetail}`]: {
          a: `${geolocation?.city?.names?.en ? `${geolocation?.city?.names?.en}, ` : ''}${
            geolocation?.subdivisions?.length ? `${geolocation?.subdivisions[0]?.iso_code}, ` : ''
          } ${geolocation?.country?.names?.en} ${geolocation.location.latitude} ${geolocation.location.longitude}`,
          dc: '#DE5833',
          i: `https://cdn.ip2location.com/assets/img/flags/${geolocation.country.iso_code?.toLowerCase()}.png`,
          q: 'test',
          t: `${search}`,
        },
        [`${suggestRelevance}`]: 99999,
      });
    }
    response[1].forEach((key, i) =>
      results.push({
        suggestion: searchingBang ? key.replace(new RegExp(`(^)(${bangSlug}\\s)?`, 'g'), `!${bangSlug} ${'$1'}`) : key,
        [`${suggestType}`]: response[4][`google:suggesttype`]?.[i],
        [`${suggestSubtypes}`]: response[4]?.[`google:suggestsubtypes`]?.[i],
        [`${suggestDetail}`]:
          typeof response[4]?.[`google:suggestdetail`]?.[i] !== 'undefined' && searchingBang
            ? { ...response[4]?.[`google:suggestdetail`]?.[i], a: `${response[4]?.[`google:suggestdetail`]?.[i]?.a} via ${bangSlug}` }
            : response[4]?.[`google:suggestdetail`]?.[i] || {},
        [`${suggestRelevance}`]: response[4][`google:suggestrelevance`]?.[i],
      })
    );
    // console.log(JSON.stringify(results, null, 2));
    if (!searchingBang) {
      const bangRequest: AxiosRequestConfig = {
        url: `https://api.duckduckgo.com/?q=${encodeURIComponent(request.query.q)}&format=json&pretty=0&no_redirect=1`,
      };
      const bangs = (await axios.request(bangRequest)).data;
      if (bangs?.Redirect) {
        results.push({
          suggestion: `${bangs?.Redirect}`,
          [`${suggestType}`]: 'ENTITY',
          [`${suggestSubtypes}`]: [bangs?.Redirect, 'DuckDuckGo', 'BANG'],
          [`${suggestDetail}`]: { a: '', dc: '#fa03fa', i: bangs?.Image, q: '', t: bangs?.Redirect },
          [`${suggestRelevance}`]: 99999,
        });
      }
      // console.log(bangs);
      const bangsRequest: AxiosRequestConfig = {
        url: `https://duckduckgo.com/ac/?q=${encodeURIComponent(request.query.q)}&format=json&pretty=0&no_redirect=1&kl=wt-wt`,
      };
      const bangss = (await axios.request(bangsRequest)).data;
      bangss.forEach((b) =>
        results.push({
          suggestion: `${b.phrase}`,
          [`${suggestType}`]: 'ENTITY',
          [`${suggestSubtypes}`]: ['DuckDuckGo'],
          [`${suggestDetail}`]: {
            a: b.snippet,
            dc: '#DE5833',
            i: b.image,
            q: '',
            t: `${b.phrase}${typeof b.snippet !== 'undefined' ? ` ${b.snippet}` : ''}`,
          },
          [`${suggestRelevance}`]: b.score,
        })
      );
    }
    suggestions.forEach((s) => {
      s.aliases.forEach((a) => {
        if (a.startsWith(bangSlug))
          results.push({
            suggestion: `!${s.name}${typeof search !== 'undefined' ? ` ${search}` : ''}`,
            [`${suggestType}`]: 'ENTITY',
            [`${suggestSubtypes}`]: ['Custom Bang', 'BANG', s.url.replace(`~QUERYHERE~`, search)],
            [`${suggestDetail}`]: {
              a: s.url.replace(`~QUERYHERE~`, search),
              dc: '#DE5833',
              i: `https://search.emu.sh/icons/${s.favicon}`,
              q: '',
              t: `!${s.name} ${s.description}`,
            },
            [`${suggestRelevance}`]: 999999,
          });
      });
    });
    results.sort((a, b) => (a[`${suggestRelevance}`] > b[`${suggestRelevance}`] ? -1 : b[`${suggestRelevance}`] > a[`${suggestRelevance}`] ? 1 : 0));
    const googleRes = {
      [`${suggestType}`]: [],
      [`${suggestSubtypes}`]: [],
      [`${suggestDetail}`]: [],
      [`${suggestRelevance}`]: [],
    };

    results.sort((a, b) => (a.relevance > b.relevance ? -1 : b.relevance > a.relevance ? 1 : 0));
    // console.log(searchFormat);
    // console.log(JSON.stringify(results, null, 2));
    // return results;
    if (request?.query?.type === 'json') return results;
    const searchFormat: Array<any> = ['', [], [], []];
    searchFormat[0] = request.query.q;
    results.forEach((res) =>
      Object.entries(res).forEach(([k, v], i) => (k === 'suggestion' ? searchFormat[1].push(v) && searchFormat[2].push('') : googleRes[k].push(v)))
    );
    // console.log(googleRes[`${suggestType}`]);
    searchFormat.push(googleRes);
    reply
      .code(200)
      .header('Content-disposition', 'attachment; filename=f.txt')
      .type('text/javascript; charset=UTF-8')
      .send(`)]}'\n${JSON.stringify(searchFormat)}`);
  });
};

export default suggest;
