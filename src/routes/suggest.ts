import axios, { AxiosRequestConfig } from "axios";
import { FastifyPluginAsync } from "fastify";
// import zlib from "zlib";
import doh from "dohjs";
import { AbortEvent } from "fastify-racing";
import http from "http";
import https from "https";
import maxmind, { CityResponse } from "maxmind";
import NodeCache from "node-cache";
import { existsSync } from "fs";
import { join } from "path";
import { ActionInfo, ActionInfo_ActionType, CategoryInfo, CategoryInfo_Category, EntityInfo } from '../proto/entity_info_pb';
import suggestions from "../suggestions";
import cryptoAssets from "../suggestions/cryptoAssets.json";
import { getGoogleRichSuggestions, getRichSuggestions } from "../rich";
const resolver = new doh.DohResolver("https://1.1.1.1/dns-query");
const bundledGeoDb = join(__dirname, "../GeoLite2-City.mmdb");
const geoDbPath = existsSync(bundledGeoDb) ? bundledGeoDb : "./src/GeoLite2-City.mmdb";
const cache = new NodeCache();
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const sendReply = (request, results, reply) => {


  const suggestType = request?.query?.type === "json" ? "suggestType" : "google:suggesttype";
  const suggestSubtypes = request?.query?.type === "json" ? "suggestSubtypes" : "google:suggestsubtypes";
  const suggestDetail = request?.query?.type === "json" ? "suggestDetail" : "google:suggestdetail";
  const suggestRelevance = request?.query?.type === "json" ? "suggestRelevance" : "google:suggestrelevance";
  const verbatimrelevance = request?.query?.type === "json" ? "verbatimrelevance" : "google:verbatimrelevance";
  const headerTexts = request?.query?.type === "json" ? "headerTexts" : "google:headertexts";
  const clientData = request?.query?.type === "json" ? "clientData" : "google:clientdata";
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
  if (request?.query?.type === "json" || request?.query?.format === "json") return results;
  const searchFormat: Array<any> = ["", [], [], []];
  searchFormat[0] = request.query.q;
  try {
    if(request.query.client !== 'firefox') {
  const decoder = new TextDecoder('utf8');
  results = results.reduce((acc,val) => ([
    ...acc, {...val, 
      [`${suggestDetail}`]: {
        "google:entityinfo": Buffer.from((new EntityInfo({
          name: val[`${suggestDetail}`].t,
          imageUrl: val[`${suggestDetail}`].i,
          dominantColor: val[`${suggestDetail}`].dc,
          annotation: val[`${suggestDetail}`].a,
        }).toBinary())).toString('base64')
      },}
    ])
      , []);
  }
  results.forEach((res) => {
    // const converted = request?.query?.format === 'json' ? res : convert(res);
    Object.entries(res).forEach(([k, v], i) => {
      try {
        k === "suggestion" ? searchFormat[1].push(v) && searchFormat[2].push("") : googleRes[k].push(v);
      } catch (e) {
        console.log("ERROR AT", k);
      }
    });
  });

  googleRes[verbatimrelevance] = typeof results[0] !== "undefined" ? results[0][`${suggestRelevance}`] : 555;
  // console.log(googleResType);
  request.query.client !== 'firefox' ? searchFormat.push(googleRes) : searchFormat[3] = googleRes;

}
catch(e){
  console.log(e);
}
const header = (request.query?.client || 'chrome-omni')?.toLowerCase() === 'firefox' ? '' : `)]}'\n`;
  return reply
    .code(200)
    .header("Content-disposition", "attachment; filename=xd.txt")
    .type("text/javascript; charset=UTF-8")
    .send(`${header}${JSON.stringify(searchFormat)}`);
};
const fetchResult = async (signal, request, reply) => {
  const ax = axios.create({
    httpAgent, // httpAgent: httpAgent -> for non es6 syntax
    httpsAgent,
    signal,
  });
  const suggestType = request?.query?.type === "json" ? "suggestType" : "google:suggesttype";
  const suggestSubtypes = request?.query?.type === "json" ? "suggestSubtypes" : "google:suggestsubtypes";
  const suggestDetail = request?.query?.type === "json" ? "suggestDetail" : "google:suggestdetail";
  const suggestRelevance = request?.query?.type === "json" ? "suggestRelevance" : "google:suggestrelevance";
  const verbatimrelevance = request?.query?.type === "json" ? "verbatimrelevance" : "google:verbatimrelevance";
  const headerTexts = request?.query?.type === "json" ? "headerTexts" : "google:headertexts";
  const clientData = request?.query?.type === "json" ? "clientData" : "google:clientdata";
  const searchRegex = request.query?.q?.match(/(?<hasBang>\!?)(?<bang>(?<=\!)[\w\d-_]+)?([\s\+]+)?(?<search>.*)?/);
  const { search, bang: bangSlug } = searchRegex?.groups ?? {};
  const q = request.query?.q;
  const searchingBang = typeof bangSlug === "string" && typeof search !== "undefined";
  const results = [];
  const addToResults = (suggestion, type, subtypes, detail, relevance) => 
    results.push({ suggestion, [suggestType]: type, [suggestSubtypes]: subtypes, [suggestDetail]: detail, [suggestRelevance]: relevance });

  const richResults = await getRichSuggestions(q);
  richResults.forEach((item, index) => addToResults(item.suggestion, item.type || (/conversion|exchange rate/i.test(item.annotation) ? "CALCULATOR" : "ENTITY"), ["emu"], {
    a: item.annotation,
    dc: "#DE5833",
    i: item.image?.startsWith('/') ? `https://${request.hostname}${item.image}` : item.image || "",
    q: "",
    t: item.title,
  }, item.relevance ?? 7000 - index));

  console.log(`search ${search}, bangSlug ${bangSlug}`);
  suggestions.forEach(s => {
    if (s.aliases.some(a => a.startsWith(bangSlug))) {
      addToResults(`!${s.name}${search ? ` ${search}` : ""}`, "ENTITY", ["Custom Bang", "BANG", s.url.replace(`~QUERYHERE~`, search)], {
        a: s.url.replace(`~QUERYHERE~`, search),
        dc: "#DE5833",
        i: `https://search.emu.sh/icons/${s.favicon}`,
        q: " ",
        t: `!${s?.name} - ${s?.description}: ${search}`,
      }, 444);
    }
  });
  const cryptoSearch = request.query?.q.trim()?.match(/(?<coef>\d+(?:\.\d+)?)?\s?(?<symbol>.*)?/);
  const assets = cryptoSearch?.groups?.symbol?.length > 2
    ? cryptoAssets.filter(a => 
        a.assetSymbol.toLowerCase() === cryptoSearch?.groups?.symbol?.toLowerCase() ||
        a.assetSymbol.toLowerCase().startsWith(cryptoSearch?.groups?.symbol?.toLowerCase()) ||
        a.assetName.toLowerCase() === cryptoSearch?.groups?.symbol?.toLowerCase()
      )
    : [];
  console.log(`assets: ${JSON.stringify(assets)}`);

  console.log(JSON.stringify(cryptoSearch));
  console.log("CryptoCompare configured, assets.length > 0", Boolean(process?.env?.CRYPTOCOMPARE_KEY), assets.length > 0)
  const cryptocompareKey = process?.env?.CRYPTOCOMPARE_KEY || false;
  if (assets.length > 0 && cryptocompareKey) {
    let opt: AxiosRequestConfig = {
      method: "GET",
      url: `https://min-api.cryptocompare.com/data/price?fsym=${assets[0].assetSymbol}&tsyms=USD&api_key=${cryptocompareKey}`,
      httpsAgent,
      httpAgent,
    };

    const cachedPrice = cache.get(assets[0].assetSymbol);
    let cryptoData: any = { data: { USD: cachedPrice } };
    if (typeof cachedPrice === "undefined") {
      console.log("price not cached");
      cryptoData = await ax.request(opt);
      cache.set(assets[0].assetSymbol, cryptoData.data.USD, 300);
    } else {
      console.log("price cached");
    }
    const coef = cryptoSearch?.groups?.coef ? cryptoSearch?.groups?.coef : 1;
    console.log(`USD`,cryptoData?.data?.USD);
    addToResults(
      `!cmc ${assets[0].assetName.toLowerCase().replace(" ", "-")}`,
      "ENTITY",
      ["crypto"],
      {
        a: `${assets[0].assetName} - ${assets[0].description}`,
        dc: "#DE5833",
        i: assets[0].image,
        q: "",
        t: `${coef} ${assets[0].assetSymbol} = $${
          coef * cryptoData.data.USD > 0.99
            ? (coef * cryptoData.data.USD)
                .toFixed(2)
                .toString()
                .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
            : `${(coef * cryptoData.data.USD)
                .toString()
                .split(".")[0]
                .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${(coef * cryptoData.data.USD).toString().split(".")[1]}`
        } USD`,
      },
      1999
    );    
  }

  // if (results.length > 0) {
  //   childSpan.end();
  //   return sendReply(request, results, reply);
  // }
  try {
    await Promise.any([
      // Dig and ip2location
      new Promise<Array<any>>(async (resolve, reject) => {
        let results = [];
        const isDig = q.match(
          /(dig\s)?(?<domain>(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9])\s(?<DNS>A|AAAA|ALIAS|CNAME|MX|NS|PTR|SOA|SRV|TXT)(\s@)?(?<ns>(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9])?/i
        );
        if (isDig?.length) {
          console.log("MATCHED");
          const response = await resolver.query(isDig.groups.domain, isDig.groups.DNS);

          await Promise.all(
            response.answers.map(async (ans, i) => {
              let answer = ans?.data?.exchange || ans?.data;
              console.log(`answer: ${JSON.stringify(ans)}`);
              let ip = "";
              // IP
              if (
                typeof answer === "string" &&
                answer?.match(/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/)
              ) {
                ip = answer;
              }
              let geolocation: any = {};
              if (await maxmind.validate(ip)) {
                const lookup = await maxmind.open<CityResponse>(geoDbPath);
                geolocation = await lookup.get(ip);
                console.log(JSON.stringify(geolocation))
              }
              console.log("hmm");
              addToResults(`!redirect https://toolbox.googleapps.com/apps/dig/?cache=${i}#${isDig.groups.DNS}/${isDig.groups.domain}`, "ENTITY", [512, 433], {
                  a: `${ans.name} ${ans.ttl} ${ans.class} ${ans.type} ${ans.data?.exchange || ans.data}`,
                  dc: "#DE5833",
                  i:
                    typeof geolocation?.country?.iso_code !== "undefined"
                      ? `https://cdn.ip2location.com/assets/img/flags/${geolocation?.country?.iso_code?.toLowerCase()}.png?cache=${i}`
                      : `https://emu.bz/gay.png`,
                  q: "",
                  t: `${ans.name} ${ans.ttl} ${ans.class} ${ans.type} ${ans.data?.exchange || ans.data}`,
                }, 512 * (response.answers.length - i));
              console.log(`${results.length} ans: ${JSON.stringify(ans)}\n\nresults:\n${JSON.stringify(results)}`);
              if (results.length) resolve(results);
            })
          );
          console.log(`results: ${JSON.stringify(results)}`);
          console.log(`results.length: ${results.length}`);
        } else {
          if (typeof search === "string" && maxmind.validate(search?.trim())) {
            const lookup = await maxmind.open<CityResponse>(geoDbPath);
            const geolocation = await lookup.get(search.trim());
            console.log(`geolocation: ${JSON.stringify(geolocation)}`); // inferred type maxmind.CityResponse
            addToResults(search, "ENTITY", ["Country"], {
              a: `${geolocation?.city?.names?.en ? `${geolocation?.city?.names?.en}, ` : ""}${
                geolocation?.subdivisions?.length ? `${geolocation?.subdivisions[0]?.iso_code}, ` : ""
              } ${geolocation?.country?.names?.en} ${(geolocation as any)?.location?.latitude} ${(geolocation as any)?.location?.longitude}`,
              dc: "#DE5833",
              i: `https://cdn.ip2location.com/assets/img/flags/${geolocation?.country?.iso_code?.toLowerCase()}.png`,
              q: "test",
              t: `${search}`,
            }, 9999);
          }
        }
        if (results.length > 0) resolve(results);
        else reject("no results");
      }),
      //DuckDuckGo bangs
      new Promise<Array<any>>(async (resolve, reject) => {
        if (typeof bangSlug !== "string" || request.query.q.trim() === "") {
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
          await Promise.all([ax.request(bangRequest).catch((e) => console.log(e.code)), ax.request(bangsRequest).catch((e) => console.log(e.code))])
            .then((res: any) => {
              const [{ data: bangs }, { data: bangss }] = res;
              if (bangs?.Redirect) {
                console.log("redirect");
                if (bangs?.Image)
                addToResults(`${request.query.q}`, "ENTITY", [512, 199, 175], {
                  a: `${bangs?.Redirect}`,
                  dc: "#DE5833",
                  i: `${bangs?.Image.startsWith("http") ? bangs?.Image : `https://duckduckgo.com/${bangs?.Image}`}`,
                  q: "redirect",
                  zae: "/g/test",
                  t: `${request.query.q.trim()}`,
                }, 900 - results.length);
              }
              // console.log(bangs);

              bangss.forEach((b) => {
                if (!searchingBang) {
                  if (b?.image?.length > 0) {
                    // b.image = b.image.substring(0, b.image.indexOf('?'));
                    b.image = b.image += "?cache=" + (Math.random() + 1).toString(36).substring(7);
                    addToResults(`${b.phrase} ${search ? `${search}` : ""}`, "ENTITY", ["DuckDuckGo"], {
                      a: b.snippet,
                      dc: "#DE5833",
                      i: b.image,
                      q: "bang",
                      zae: "/g/test",
                      t: `${b.phrase}${search ? ` ${search}` : ""} - ${typeof b.snippet !== "undefined" ? ` ${b.snippet}` : ""}`,
                    }, 6000 - results.length);
                  }
                } else {
                  if (b?.phrase?.startsWith(`!${bangSlug}`)) {
                    addToResults(`${b.phrase}${search ? ` ${search}` : ""}`, "ENTITY", ["DuckDuckGo"], {
                      a: b.snippet || bangs?.Redirect,
                      dc: "#DE5833",
                      i: b.image,
                      q: "alice=true",
                      zae: "/g/test",
                      t: `${b.phrase}${search ? ` ${search}` : ""} - ${typeof b.snippet !== "undefined" ? ` ${b.snippet}` : ""}`,
                    }, 800 - results.length);
                  }
                }
              });
              if (results.length > 0) resolve(results);
            })
            .catch((e) => console.log(e.code));
        }
        if (results.length > 0) resolve(results);
        else reject("no results");
      }),
    ]);
    console.log(`results::: ${results}`);
  } catch (e) {
    console.error(e.message);
  }
  console.log("results length", results.length);
  if (results.length < 4) {
    const googleResults = await getGoogleRichSuggestions(searchingBang ? search : q, searchingBang ? bangSlug : undefined);
    googleResults.forEach((item) => addToResults(item.suggestion, item.type || "QUERY", [], {
      a: item.annotation,
      dc: "#DE5833",
    i: item.image?.startsWith('/') ? `https://${request.hostname}${item.image}` : item.image || "",
      q: "",
      t: item.title,
    }, item.relevance));
  }
  reply.code(200);
  console.log("sending reply")
  return sendReply(request, results, reply);
};
const suggest: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get("/suggest", async function (request: any, reply) {
    console.log("request", request.query.q);
    const signal = request.race();
    const result: AbortEvent | unknown = await Promise.race([
      signal,
      new Promise(async (resolve, reject) => {
        let result = "";
        try {
          result = await fetchResult(signal, request, reply);
          resolve(result);
        } catch (e) {
          console.error(e?.message || e?.code || e);
          result = e?.message || e?.code || e;
          reject(result);
        }
      }).catch((e) => {console.trace(e); console.log(`ERROR\n\n ${e?.message || e?.code || e}`); return sendReply(request, [], reply)}),
    ]);
    if ((<AbortEvent>result)?.type === "aborted") {
      return "aborted";
    }
    return result;
  });
};

export default suggest;
