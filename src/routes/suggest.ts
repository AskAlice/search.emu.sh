import { FastifyPluginAsync } from 'fastify';
import axios, { AxiosRequestConfig } from 'axios';
// import zlib from "zlib";
import suggestions from '../suggestions';
import cryptoAssets from '../suggestions/cryptoAssets.json';
import maxmind, { CityResponse } from 'maxmind';
import doh from 'dohjs';
const resolver = new doh.DohResolver('https://1.1.1.1/dns-query');
import NodeCache from 'node-cache';
const cache = new NodeCache();

/* Notes 

Possible to send header data with suggestions? https://github.dev/chromium/chromium/blob/e590866de188fbe1efe182b3be1db42155f55667/components/omnibox/browser/search_suggestion_parser.cc#L518-L529

*/
const suggest: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/suggest', async function (request: any, reply) {
    let useApiKeys: boolean = false; // query param to actually utilize the API keys specified in .env
    if (request.query?.useApiKeys === 'true') {
      useApiKeys = true;
    }
    // console.log(request.headers);
    const searchRegex = request.query?.q?.match(/(?<hasBang>\!?)(?<bang>(?<=\!)[\w\d-_]+)?([\s\+]+)?(?<search>.*)?/);
    const search = searchRegex?.groups.search;
    // let hasBang = searchRegex.groups.hasBang === '!' ? true : false;
    const q = request.query?.q;
    const bangSlug = searchRegex?.groups.bang;
    const searchingBang = typeof bangSlug === 'string' && typeof search !== 'undefined';
    const googleQuery = searchingBang ? { ...request.query, q: search } : request.query;
    delete googleQuery.useApiKeys; // used internally, don't pass this to google
    console.log('hi');
    console.log(`search ${search},bangSlug ${bangSlug},googleQuery ${JSON.stringify(googleQuery)}`);
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
    const verbatimrelevance = request?.query?.type === 'json' ? 'verbatimrelevance' : 'google:verbatimrelevance';
    const headerTexts = request?.query?.type === 'json' ? 'headerTexts' : 'google:headertexts';
    const clientData = request?.query?.type === 'json' ? 'clientData' : 'google:clientdata';
    let results = [];
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
      /(dig\s)?(?<domain>(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9])\s(?<DNS>A|AAAA|ALIAS|CNAME|MX|NS|PTR|SOA|SRV|TXT)(\s@)?(?<ns>(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9])?/i
    );
    if (isDig?.length) {
      console.log('MATCHED');
      const response = await resolver.query(isDig.groups.domain, isDig.groups.DNS);
      const lookup = await maxmind.open<CityResponse>('./src/GeoLite2-City.mmdb');
      response.answers.forEach(async (ans, i) => {
        let answer = ans?.data?.exchange || ans?.data;
        console.log(JSON.stringify(ans));
        let ip = '';
        // IP
        if (
          typeof answer === 'string' &&
          answer?.match(/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/)
        ) {
          ip = answer;
        }
        // hostname
        if (
          typeof answer === 'string' &&
          answer?.match(/^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/)
        ) {
          const ipQuery = await resolver.query(answer, 'A');
          console.log(`ipQuery ${JSON.stringify(ipQuery)}`);
          ip = ipQuery?.answers?.length ? ipQuery?.answers[0]?.data : ip;
        }
        let geolocation: any = {};
        if (maxmind.validate(ip)) {
          geolocation = lookup.get(ip);
        }

        results.push({
          suggestion: `${`!redirect https://toolbox.googleapps.com/apps/dig/?cache=${i}#${isDig.groups.DNS}/${isDig.groups.domain}`}`,
          [`${suggestType}`]: 'ENTITY',
          [`${suggestSubtypes}`]: [512, 433],
          [`${suggestDetail}`]: {
            a: `${ans.name} ${ans.ttl} ${ans.class} ${ans.type} ${ans.data?.exchange || ans.data}`,
            dc: '#DE5833',
            i: geolocation?.country?.iso_code
              ? `https://cdn.ip2location.com/assets/img/flags/${geolocation?.country?.iso_code?.toLowerCase()}.png?cache=${i}`
              : `https://emu.bz/gay`,
            q: '',
            t: `${ans.name} ${ans.ttl} ${ans.class} ${ans.type} ${ans.data?.exchange || ans.data}`,
          },
          // {
          //     a: `test ${ans.data}`,
          //     dc: '#fa03fa',
          //     i: 'https://cdn.ip2location.com/assets/img/flags/us.png',
          //     q: '',
          //     t: `${ans.name} ${ans.ttl} ${ans.class} ${ans.type} ${ans.data?.exchange || ans.data}`,
          //   },
          [`${suggestRelevance}`]: 512 * (response.answers.length - i),
        });
        console.log(`ans: ${JSON.stringify(ans)}`);
      });
      console.log(results);
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
    const bangRequest: AxiosRequestConfig = {
      url: `https://api.duckduckgo.com/?q=${encodeURIComponent(request.query.q.trim())}&format=json&pretty=0&no_redirect=1`,
    };
    const bangs = (await axios.request(bangRequest)).data;
    if (!searchingBang) {
      console.log('!searchingBang');
      if (bangs?.Redirect) {
        console.log('bangs');
        console.log(bangs);
        console.log('bangs');
        if (bangs?.Image)
          results.push({
            suggestion: `${bangs?.Redirect}`,
            [`${suggestType}`]: 'ENTITY',
            [`${suggestSubtypes}`]: ['Custom Bang', 'BANG'],
            [`${suggestDetail}`]: {
              a: bangs?.Redirect,
              dc: '#DE5833',
              i: `${bangs?.Image.startsWith('http') ? bangs?.Image : `https://duckduckgo.com/${bangs?.Image}`}`,
              q: '',
              t: bangs?.Redirect,
            },
            [`${suggestRelevance}`]: bangs.Score,
          });
      }
      // console.log(bangs);
      const bangsRequest: AxiosRequestConfig = {
        url: `https://duckduckgo.com/ac/?q=${encodeURIComponent(request.query.q.trim())}&format=json&pretty=0&no_redirect=1&kl=wt-wt`,
      };
      const bangss = (await axios.request(bangsRequest)).data;
      bangss.forEach((b) => {
        if (b?.image?.length > 0) {
          // b.image = b.image.substring(0, b.image.indexOf('?'));
          b.image = b.image += '?cache=' + (Math.random() + 1).toString(36).substring(7);
          results.push({
            suggestion: `${b.phrase}`,
            [`${suggestType}`]: 'ENTITY',
            [`${suggestSubtypes}`]: ['DuckDuckGo'],
            [`${suggestDetail}`]: {
              a: b.snippet,
              dc: '#DE5833',
              i: b.image,
              q: '',
              t: `${b.phrase} - ${typeof b.snippet !== 'undefined' ? ` ${b.snippet}` : ''}`,
            },
            [`${suggestRelevance}`]: b.score,
          });
        }
      });
    } else {
      console.log('searchingBang');
      const bangRequest: AxiosRequestConfig = {
        url: `https://api.duckduckgo.com/?q=${encodeURIComponent(request.query.q)}&format=json&pretty=0&no_redirect=1`,
      };
      const bangsRequest: AxiosRequestConfig = {
        url: `https://duckduckgo.com/ac/?q=!${encodeURIComponent(bangSlug)}&format=json&pretty=0&no_redirect=1&kl=wt-wt`,
      };
      const bangs = (await axios.request(bangRequest)).data;
      const bangss = (await axios.request(bangsRequest)).data;
      console.log(`bangs: ${JSON.stringify(bangs)}\n, bangss: ${JSON.stringify(bangss)}`);
      bangss.forEach((b) => {
        console.log(`b ${JSON.stringify(b)}`);
        console.log(`image: ${b.image}`);
        if (b.phrase === `!${bangSlug}`) {
          results = results.filter((r) => r.suggestion !== `!${bangSlug}`);
          b.image = b.image.substring(0, b.image.indexOf('?'));

          results.push({
            suggestion: `${request.query.q}`,
            [`${suggestType}`]: 'ENTITY',
            [`${suggestSubtypes}`]: ['DuckDuckGo'],
            [`${suggestDetail}`]: {
              a: `${bangs?.Redirect}`,
              dc: '#DE5833',
              i: b.image,
              q: '',
              t: `${b.phrase} - ${typeof b.snippet !== 'undefined' ? ` ${b.snippet}` : ''}`,
            },
            [`${suggestRelevance}`]: 8888 + b.score,
          });
        }
      });
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
              q: ' ',
              t: `!${s.name} ${s.description}`,
            },
            [`${suggestRelevance}`]: 99999 + s.score,
          });
      });
    });
    console.log(results);

    results.sort((a, b) => (a[`${suggestRelevance}`] > b[`${suggestRelevance}`] ? -1 : b[`${suggestRelevance}`] > a[`${suggestRelevance}`] ? 1 : 0));
    const googleRes = {
      [`${suggestType}`]: [],
      [`${headerTexts}`]: [],
      [`${clientData}`]: [],
      [`${suggestSubtypes}`]: [],
      [`${suggestDetail}`]: [],
      [`${suggestRelevance}`]: [],
    };

    results.sort((a, b) => (a.relevance > b.relevance ? -1 : b.relevance > a.relevance ? 1 : 0));
    // console.log(searchFormat);
    console.log(JSON.stringify(results, null, 2));
    // return results;
    if (request?.query?.type === 'json' || request?.query?.format === 'json') return results;
    const searchFormat: Array<any> = ['', [], [], []];
    searchFormat[0] = request.query.q;
    results.forEach((res) =>
      Object.entries(res).forEach(([k, v], i) => (k === 'suggestion' ? searchFormat[1].push(v) && searchFormat[2].push('') : googleRes[k].push(v)))
    );
    googleRes[verbatimrelevance] = results[0][`${suggestRelevance}`];
    // console.log(googleRes[`${suggestType}`]);
    searchFormat.push(googleRes);
    reply
      .code(200)
      .header('Content-disposition', 'attachment; filename=xd.txt')
      .type('text/javascript; charset=UTF-8')
      .send(`)]}'\n${JSON.stringify(searchFormat)}`);
  });
};

export default suggest;
