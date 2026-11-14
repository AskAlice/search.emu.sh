import { braveSuggestions } from '../providers/brave';
import { parseDnsQuery } from '../providers/dns';
import axios, { AxiosRequestConfig } from "axios";
import { FastifyPluginAsync } from "fastify";
// import zlib from "zlib";
import doh from "dohjs";
import http from "http";
import https from "https";
import maxmind, { CityResponse } from "maxmind";
import NodeCache from "node-cache";
import { existsSync } from "fs";
import { join } from "path";
import { ActionInfo, ActionInfo_ActionType, CategoryInfo, CategoryInfo_Category, EntityInfo } from '../proto/entity_info_pb';
import { getBangs, bangDestination } from "../suggestions";
import cryptoAssets from "../suggestions/cryptoAssets.json";
import { getGoogleRichSuggestions, getRichSuggestions, featureIcon, plainText } from "../rich";
const resolver = new doh.DohResolver("https://1.1.1.1/dns-query");
const bundledGeoDb = join(__dirname, "../GeoLite2-City.mmdb");
const geoDbPath = existsSync(bundledGeoDb) ? bundledGeoDb : "./src/GeoLite2-City.mmdb";
// Opening the 70 MB GeoLite DB costs far more than a lookup; open it once per process.
let geoReader: ReturnType<typeof maxmind.open<CityResponse>> | undefined;
// Crisp SVG flag for an ISO 3166-1 alpha-2 country code.
const flagUrl = (code?: string) => `https://flagcdn.com/${/^[a-z]{2}$/i.test(code || '') ? code!.toLowerCase() : 'un'}.svg`;
const openGeoDb = () => (geoReader ??= maxmind.open<CityResponse>(geoDbPath).catch(error => { geoReader = undefined; throw error; }));
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
  results.sort((a, b) => (b[suggestRelevance] || 0) - (a[suggestRelevance] || 0));
  // One row per suggestion, ignoring case. A rich row (entity/template/ENTITY type) replaces a plain one
  // in the plain row's higher-ranked slot, so "brad pitt" becomes "Brad Pitt — American actor" with its picture.
  const richness = item => (item[suggestDetail]?.entityInfo || item[suggestDetail]?.template ? 2 : 0)
    + ([].concat(item[suggestType]).some(type => type === 'ENTITY' || type === 'PERSON') ? 1 : 0);
  const slots = new Map<string, number>();
  const deduped: any[] = [];
  for (const item of results) {
    const key = item.suggestion.toLowerCase(), slot = slots.get(key);
    if (slot === undefined) { slots.set(key, deduped.length); deduped.push(item); }
    else if (richness(item) > richness(deduped[slot])) deduped[slot] = { ...item, [suggestRelevance]: deduped[slot][suggestRelevance] };
  }
  results = deduped;
  if (request?.query?.type === "json" || request?.query?.format === "json") return results;
  const searchFormat: Array<any> = ["", [], [], []];
  searchFormat[0] = request.query.q;
  try {
    if(request.query.client !== 'firefox') {
  const decoder = new TextDecoder('utf8');
  results = results.reduce((acc,val) => ([
    ...acc, {...val, 
      [`${suggestDetail}`]: {
        ...(val[`${suggestDetail}`].template ? { "google:suggesttemplate": val[`${suggestDetail}`].template } : {}),
        "google:entityinfo": val[`${suggestDetail}`].entityInfo || Buffer.from((new EntityInfo({
          name: val[`${suggestDetail}`].t,
          imageUrl: ["ENTITY", "PERSON"].includes(val[`${suggestType}`]) ? val[`${suggestDetail}`].i : undefined,
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
const fetchResult = async (signal: AbortSignal, request, results: any[], answerReady: () => void) => {
  const ax = axios.create({
    httpAgent, // httpAgent: httpAgent -> for non es6 syntax
    httpsAgent,
    signal,
    timeout: 750,
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
  const bangQuery = /^![\w-]+\s/.test(q);
  const searchingBang = typeof bangSlug === "string" && typeof search !== "undefined";
  const addToResults = (suggestion, type, subtypes, detail, relevance) => {
    if (signal.aborted) return;
    const cleanDetail = Object.fromEntries(Object.entries(detail || {}).map(([key, value]) => [key, typeof value === 'string' ? plainText(value) : value]));
    results.push({ suggestion: plainText(String(suggestion)), [suggestType]: type, [suggestSubtypes]: subtypes, [suggestDetail]: cleanDetail, [suggestRelevance]: relevance });
  };

  const googleQuery = bangQuery ? search || "" : searchingBang ? search : q;
  const googleTask = getGoogleRichSuggestions(googleQuery, bangQuery ? bangSlug : undefined, signal, request.query, bangQuery ? q.length - googleQuery.length : 0).then(googleResults => {
    googleResults.forEach((item) => addToResults(item.suggestion, item.type || "QUERY", item.subtypes || [], {
      a: item.annotation,
      dc: item.dominantColor || "",
      i: featureIcon(item)?.startsWith('/') ? `https://${request.hostname}${featureIcon(item)}` : featureIcon(item) || "",
      template: item.suggestTemplate,
      entityInfo: item.entityInfo,
      category: item.categories,
      website: item.website,
      q: item.searchParameters || "",
      t: item.title,
    }, item.relevance));
  }).catch(() => {});

  const braveTask = braveSuggestions(googleQuery, bangQuery ? bangSlug : undefined, signal, request.query).then(items => {
    for (const item of items) {
      const icon = featureIcon(item);
      addToResults(item.suggestion, item.type || 'QUERY', [], {
        a: item.annotation, t: item.title, dc: '', q: '',
        i: icon?.startsWith('/') ? `https://${request.hostname}${icon}` : icon || '',
      }, item.relevance);
    }
  }).catch(() => {});

  const richTask = getRichSuggestions(q, signal).then(richResults => {
    richResults.forEach((item, index) => {
    const icon = featureIcon({ ...item, type: item.type || (/^(Unit conversion|Frankfurter exchange rate)/i.test(item.annotation) ? "CALCULATOR" : "ENTITY") });
    addToResults(item.suggestion, item.type || (/^(Unit conversion|Frankfurter exchange rate)/i.test(item.annotation) ? "CALCULATOR" : "ENTITY"), ["emu"], {
      a: item.annotation,
      dc: "#DE5833",
      i: icon?.startsWith('/') ? `https://${request.hostname}${icon}` : icon || "",
      q: "",
      t: item.title,
    }, item.relevance ?? 7000 - index);
    });
    if (richResults.length && !bangQuery) answerReady();
  }).catch(() => {});
  getBangs(request.headers.cookie).forEach(s => {
    if (q?.startsWith("!") && (bangQuery ? s.aliases.includes((bangSlug || "").toLowerCase()) : s.aliases.some(a => a.startsWith((bangSlug || "").toLowerCase())))) {
      addToResults(`!${bangQuery ? bangSlug : s.name}${search ? ` ${search}` : ""}`, "ENTITY", ["Custom Bang", "BANG", bangDestination(s, search || "") || s.url], {
        a: bangDestination(s, search || "") || s.url,
        dc: "#DE5833",
        i: `https://search.emu.sh/icons/${s.favicon}`,
        q: " ",
        t: `!${s?.name} - ${s?.description}: ${search}`,
      }, bangQuery ? 100 : s.aliases.includes((bangSlug || "").toLowerCase()) ? 8000 : 6000);
      if (!bangQuery && s.aliases.includes((bangSlug || "").toLowerCase())) answerReady();
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

  const cryptocompareKey = process?.env?.CRYPTOCOMPARE_KEY || false;
  const cryptoTask = (async () => {
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
      cryptoData = await ax.request(opt);
      cache.set(assets[0].assetSymbol, cryptoData.data.USD, 300);
    }
    const coef = cryptoSearch?.groups?.coef ? cryptoSearch?.groups?.coef : 1;
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

  })().catch(() => {});
  const legacyTask = (async () => {
    await Promise.allSettled([
      // Dig and ip2location
      (async () => {
        const dns = parseDnsQuery(q);
        if (dns) {
          const response = await resolver.query(dns.domain, dns.type, "POST", null, 750);

          await Promise.all(
            response.answers.map(async (ans, i) => {
              let answer = ans?.data?.exchange || ans?.data;
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
                const lookup = await openGeoDb();
                geolocation = await lookup.get(ip);
              }
              addToResults(`!redirect https://toolbox.googleapps.com/apps/dig/?cache=${i}#${dns.type}/${dns.domain}`, "ENTITY", [512, 433], {
                  a: `${ans.name} ${ans.ttl} ${ans.class} ${ans.type} ${ans.data?.exchange || ans.data}`,
                  dc: "#DE5833",
                  i:
                    typeof geolocation?.country?.iso_code !== "undefined"
                      ? `${flagUrl(geolocation?.country?.iso_code)}?cache=${i}`
                      : `https://${request.hostname}/icon/DNS.svg`,
                  q: "",
                  t: `${ans.name} ${ans.ttl} ${ans.class} ${ans.type} ${ans.data?.exchange || ans.data}`,
                }, 6500 - i);
              if (results.length) return results;
            })
          );
        } else {
          if (typeof search === "string" && maxmind.validate(search?.trim())) {
            const lookup = await openGeoDb();
            const geolocation = await lookup.get(search.trim());
            addToResults(search, "ENTITY", ["Country"], {
              a: `${geolocation?.city?.names?.en ? `${geolocation?.city?.names?.en}, ` : ""}${
                geolocation?.subdivisions?.length ? `${geolocation?.subdivisions[0]?.iso_code}, ` : ""
              } ${geolocation?.country?.names?.en} ${(geolocation as any)?.location?.latitude} ${(geolocation as any)?.location?.longitude}`,
              dc: "#DE5833",
              i: geolocation?.country?.iso_code ? flagUrl(geolocation.country.iso_code) : `https://${request.hostname}/icon/DNS.svg`,
              q: "test",
              t: `${search}`,
            }, 9999);
          }
        }
        if (results.length > 0) return results;
        else return [];
      })(),
      //DuckDuckGo bangs
      (async () => {
        if (bangQuery || typeof bangSlug !== "string" || request.query.q.trim() === "") {
          return [];
        } else {
          const bangRequest: AxiosRequestConfig = {
            url: `https://api.duckduckgo.com/?q=${encodeURIComponent(request.query.q.trim())}&format=json&pretty=0&no_redirect=1`,
          };
          const bangsRequest: AxiosRequestConfig = {
            url: `https://duckduckgo.com/ac/?q=${encodeURIComponent(
              !searchingBang ? request.query.q.trim() : `!${bangSlug}`
            )}&format=json&pretty=0&no_redirect=1&kl=wt-wt`,
          };
          await Promise.all([ax.request(bangRequest).catch((e) => console.log(e.code)), ax.request(bangsRequest).catch((e) => console.log(e.code))])
            .then((res: any) => {
              const bangs = res[0]?.data;
              const bangss = Array.isArray(res[1]?.data) ? res[1].data : [];
              if (bangs?.Redirect) {
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

              bangss.forEach((b, i) => {
                if (!searchingBang) {
                  if (b?.image?.length > 0) {
                    // Unique per row so Chrome keeps each icon, but stable so the browser can cache it.
                    b.image += `${b.image.includes("?") ? "&" : "?"}cache=${i}`;
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
              if (results.length > 0) return results;
            })
            .catch((e) => console.log(e.code));
        }
        if (results.length > 0) return results;
        else return [];
      })(),
    ]);
  })();
  await Promise.allSettled([richTask, googleTask, braveTask, cryptoTask, legacyTask]);
};
const suggest: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get("/suggest", async function (request: any, reply) {
    reply.header("Cache-Control", "private, no-store");
    reply.header("Vary", "Cookie");
    if (typeof request.query.q !== 'string') return reply.code(400).send({ error: 'q must be a string' });
    const controller = new AbortController();
    const results: any[] = [];
    let deadline: ReturnType<typeof setTimeout>;
    const disconnected = () => controller.abort();
    reply.raw.once('close', disconnected);
    let answerReady: () => void;
    const decisiveAnswer = new Promise<void>(resolve => { answerReady = resolve; });
    try {
      await Promise.race([
        fetchResult(controller.signal, request, results, answerReady).catch(() => {}),
        decisiveAnswer,
        new Promise<void>(resolve => { deadline = setTimeout(resolve, 900); }),
      ]);
      controller.abort();
      return sendReply(request, results, reply);
    } finally {
      clearTimeout(deadline);
      reply.raw.removeListener('close', disconnected);
    }
  });
};

export default suggest;
