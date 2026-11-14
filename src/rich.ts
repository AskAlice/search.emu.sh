import { mediaSuggestions } from './providers/media';
import { cachedGet } from './providers/http';
import { EntityInfo } from './proto/entity_info_pb';
import { chromiumIcon, decodeSuggestTemplate } from './chromium/icons';
import axios from "axios";
import { randomUUID } from "crypto";
import doh from "dohjs";
import tls from "tls";

export interface RichSuggestion {
  suggestion: string;
  title: string;
  annotation: string;
  image?: string;
  type?: string;
  relevance?: number;
  suggestTemplate?: string;
  source?: 'google' | 'brave';
  entityInfo?: string;
  subtypes?: Array<number | string>;
  dominantColor?: string;
  searchParameters?: string;
  categories?: number[];
  website?: string;
}

const TIMEOUT = 5000;
const answer = (suggestion: string, title: string, annotation: string): RichSuggestion => ({
  suggestion, title, annotation, relevance: 7000,
});
const redirect = (url: string, title: string, annotation: string): RichSuggestion =>
  answer(`!redirect ${url}`, title, annotation);

export function plainText(value: string): string {
  const decoded = value.replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;|&apos;|&#(\d+);/g, (entity) => {
    if (entity === '&nbsp;') return ' ';
    if (entity === '&amp;') return '&';
    if (entity === '&lt;') return '<';
    if (entity === '&gt;') return '>';
    if (entity === '&quot;') return '"';
    if (entity === '&#39;' || entity === '&apos;') return "'";
    return String.fromCharCode(Number(entity.slice(2, -1)));
  });
  return decoded.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export function featureIcon(item: RichSuggestion): string | undefined {
  const template = decodeSuggestTemplate(item.suggestTemplate);
  if (item.type === 'CALCULATOR') return chromiumIcon('CALCULATOR');
  if (template?.image?.url) return template.image.url;
  if (item.image) return item.image;
  if (template?.typeIcon || item.source === 'google') return chromiumIcon(item.type, template);
  if (item.type && !['ENTITY', 'PERSON'].includes(item.type)) return chromiumIcon(item.type);
  const text = `${item.suggestion} ${item.title} ${item.annotation}`.toLowerCase();
  const icons: Array<[RegExp, string]> = [
    [/tls certificate/, 'SSL'], [/mail configuration|mailcheck/, 'MX'], [/rdap|whois/, 'RDAP'],
    [/toolbox\.googleapps|dns/, 'DNS'], [/github/, 'GH'], [/npmjs|npm package|!npm/, 'NPM'],
    [/developer\.mozilla|mdn/, 'MDN'], [/nvd\.nist|cve-/, 'CVE'], [/coolors|rgb\(/, 'COLOR'],
    [/frankfurter|exchange rate/, 'FX'], [/unit conversion/, 'CALC'], [/timestamp|\bgmt\b|asia\/|america\/|utc/, 'TIME'],
    [/isbn/, 'ISBN'], [/doi\.org|doi /, 'DOI'], [/arxiv/, 'ARX'], [/17track|shipment/, 'TRK'],
    [/flightaware|flight /, 'FL'], [/base64/, 'B64'], [/url-encoded|urlencode/, 'TXT'], [/uuid/, 'ID'],
    [/redirects|https?:\/\//, 'URL'],
  ];
  const icon = icons.find(([pattern]) => pattern.test(text))?.[1] || 'EMU';
  if (icon === 'GH') return '/icons/github.png';
  return `/icon/${icon}.svg?v=2`;
}

export function cleanUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const blocked = new Set(["fbclid", "gclid", "mc_cid", "mc_eid"]);
    const keys: string[] = [];
    url.searchParams.forEach((_, key) => keys.push(key));
    for (const key of keys) {
      if (key.toLowerCase().startsWith("utm_") || blocked.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return raw;
  }
}

const UNIT_GROUPS: Array<[string, number, string[]]> = [
  ["length", 1, ["m", "meter", "meters", "metre", "metres"]],
  ["length", 1000, ["km", "kilometer", "kilometers", "kilometre", "kilometres"]],
  ["length", 0.01, ["cm", "centimeter", "centimeters", "centimetre", "centimetres"]],
  ["length", 0.001, ["mm", "millimeter", "millimeters"]],
  ["length", 1609.344, ["mi", "mile", "miles"]],
  ["length", 0.3048, ["ft", "foot", "feet"]],
  ["length", 0.0254, ["in", "inch", "inches"]],
  ["length", 0.9144, ["yd", "yard", "yards"]],
  ["mass", 1, ["kg", "kilogram", "kilograms"]],
  ["mass", 0.001, ["g", "gram", "grams"]],
  ["mass", 0.45359237, ["lb", "lbs", "pound", "pounds"]],
  ["mass", 0.028349523125, ["oz", "ounce", "ounces"]],
];
const TEMP: Record<string, string> = {
  c: "c", celsius: "c", "°c": "c", f: "f", fahrenheit: "f", "°f": "f",
  k: "k", kelvin: "k",
};

export function convertUnit(value: number, from: string, to: string): number | null {
  const source = from.toLowerCase();
  const target = to.toLowerCase();
  if (TEMP[source] || TEMP[target]) {
    if (!TEMP[source] || !TEMP[target]) return null;
    const celsius = TEMP[source] === "c" ? value : TEMP[source] === "f" ? (value - 32) * 5 / 9 : value - 273.15;
    const result = TEMP[target] === "c" ? celsius : TEMP[target] === "f" ? celsius * 9 / 5 + 32 : celsius + 273.15;
    return Number(result.toFixed(6));
  }
  const find = (name: string) => {
    for (const [kind, factor, names] of UNIT_GROUPS) {
      if (names.includes(name)) return { kind, factor };
    }
    return null;
  };
  const a = find(source);
  const b = find(target);
  return a && b && a.kind === b.kind ? Number((value * a.factor / b.factor).toFixed(6)) : null;
}

export function hexToRgbHsl(input: string) {
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(input)) return null;
  const full = input.length === 4 ? input.slice(1).split("").map(c => c + c).join("") : input.slice(1);
  const rgb = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  const [r, g, b] = rgb.map(v => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return {
    hex: `#${full.toUpperCase()}`,
    rgb,
    hsl: [Math.round(hue), Math.round(saturation * 100), Math.round(lightness * 100)],
  };
}

const COMMANDS = [
  ["!gh owner/repo", "Open and inspect a GitHub repository"],
  ["!mdn query", "Search MDN Web Docs"],
  ["!track number", "Track a shipment with 17TRACK"],
  ["!flight code", "Look up a flight on FlightAware"],
  ["!rdap domain", "Look up domain registration with RDAP"],
  ["!ssl domain", "Inspect a domain TLS certificate"],
  ["!mailcheck domain", "Check MX, SPF, DMARC, and optional DKIM records"],
];
const discovery = (prefix: string): RichSuggestion[] => COMMANDS
  .filter(([usage]) => usage.slice(1).startsWith(prefix))
  .map(([usage, description]) => ({
    suggestion: usage, title: usage.split(" ")[0], annotation: description, relevance: 4500,
  }));

const validDomain = (domain: string) => /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain);

async function rdap(domain: string, signal?: AbortSignal): Promise<RichSuggestion[]> {
  const url = domain.toLowerCase().endsWith(".sh")
    ? `https://rdap.identitydigital.services/rdap/domain/${encodeURIComponent(domain)}`
    : `https://rdap.org/domain/${encodeURIComponent(domain)}`;
  const data = await cachedGet(url, 3600, { timeout: TIMEOUT, signal });
  const registrarEntity = data.entities?.find((entity: any) => entity.roles?.includes("registrar"));
  const registrar = registrarEntity?.vcardArray?.[1]?.find((field: any[]) => field[0] === "fn")?.[3];
  const expiry = data.events?.find((event: any) => event.eventAction === "expiration")?.eventDate;
  const nameservers = data.nameservers?.map((ns: any) => ns.ldhName).filter(Boolean).join(", ");
  const annotation = [
    registrar && `Registrar: ${registrar}`,
    expiry && `Expires: ${expiry}`,
    nameservers && `NS: ${nameservers}`,
  ].filter(Boolean).join(" · ") || "RDAP record available";
  return [redirect(url, data.ldhName || domain, annotation)];
}

function certificate(domain: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: domain, servername: domain, port: 443, timeout: TIMEOUT });
    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      resolve(cert);
    });
    socket.once("timeout", () => socket.destroy(new Error("TLS timeout")));
    socket.once("error", reject);
  });
}

async function mailcheck(domain: string, selector?: string): Promise<RichSuggestion[]> {
  const resolver = new doh.DohResolver("https://1.1.1.1/dns-query");
  const query = (name: string, type: string) => resolver.query(name, type, "POST", null, TIMEOUT);
  const requests = [query(domain, "MX"), query(domain, "TXT"), query(`_dmarc.${domain}`, "TXT")];
  if (selector) requests.push(query(`${selector}._domainkey.${domain}`, "TXT"));
  const [mx, txt, dmarc, dkim] = await Promise.all(requests);
  const records = (response: any) => (response?.answers || []).map((entry: any) => String(entry.data));
  const summary = [
    `MX: ${records(mx).length ? "pass" : "missing"}`,
    `SPF: ${records(txt).some((v: string) => v.toLowerCase().includes("v=spf1")) ? "pass" : "missing"}`,
    `DMARC: ${records(dmarc).some((v: string) => v.toLowerCase().includes("v=dmarc1")) ? "pass" : "missing"}`,
  ];
  if (selector) summary.push(`DKIM (${selector}): ${records(dkim).length ? "pass" : "missing"}`);
  return [answer(`mailcheck ${domain}${selector ? ` ${selector}` : ""}`, `${domain} mail configuration`, summary.join(" · "))];
}

async function inspectUrl(input: string, signal?: AbortSignal): Promise<RichSuggestion[]> {
  let current = new URL(input).toString();
  let status = 0;
  let redirects = 0;
  const started = Date.now();
  while (true) {
    const response = await axios.request({
      method: "HEAD", url: current, maxRedirects: 0, validateStatus: () => true, timeout: TIMEOUT, signal,
    });
    status = response.status;
    const location = response.headers.location;
    if (status >= 300 && status < 400 && location && redirects < 5) {
      const next = new URL(location, current);
      if (!/^https?:$/.test(next.protocol)) break;
      current = next.toString();
      redirects++;
    } else break;
  }
  const finalUrl = cleanUrl(current);
  return [redirect(finalUrl, `${status} · ${finalUrl}`, `${Date.now() - started}ms · ${redirects} redirects`)];
}

const ZONES: Record<string, string> = {
  utc: "UTC", gmt: "Europe/London", est: "America/New_York", edt: "America/New_York",
  pst: "America/Los_Angeles", pdt: "America/Los_Angeles", bst: "Europe/London",
  cet: "Europe/Paris", ist: "Asia/Kolkata", jst: "Asia/Tokyo", tokyo: "Asia/Tokyo",
  london: "Europe/London", new_york: "America/New_York", los_angeles: "America/Los_Angeles",
};
const zoneFor = (name: string) => ZONES[name.toLowerCase().replace(/[ ]+/g, "_")] || (name.includes("/") ? name : null);
function zoneParts(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}
function convertTime(hour: number, minute: number, source: string, target: string): Date {
  const today = zoneParts(new Date(), source);
  const wallTime = Date.UTC(today.year, today.month - 1, today.day, hour, minute);
  let timestamp = wallTime;
  for (let i = 0; i < 2; i++) {
    const part = zoneParts(new Date(timestamp), source);
    timestamp += wallTime - Date.UTC(part.year, part.month - 1, part.day, part.hour, part.minute);
  }
  return new Date(timestamp);
}

function validIsbn(isbn: string): boolean {
  if (/^\d{9}[\dX]$/i.test(isbn)) {
    return isbn.split("").reduce((sum, c, i) => sum + (10 - i) * (c.toUpperCase() === "X" ? 10 : Number(c)), 0) % 11 === 0;
  }
  return /^\d{13}$/.test(isbn) && isbn.split("").reduce((sum, c, i) => sum + Number(c) * (i % 2 ? 3 : 1), 0) % 10 === 0;
}

async function command(q: string, signal?: AbortSignal): Promise<RichSuggestion[] | null> {
  if (/^!npm(?:\s|$)/i.test(q)) return null;
  const match = q.match(/^!?(gh|npm|mdn|track|flight|rdap|ssl|mailcheck)\b\s*(.*)$/i);
  if (!match) return null;
  const name = match[1].toLowerCase();
  const arg = match[2].trim();
  if (!arg) return [];
  if (name === "track") return [redirect(`https://17track.net/en/track?nums=${encodeURIComponent(arg)}`, `Track ${arg}`, "17TRACK shipment tracking")];
  if (name === "flight") return [redirect(`https://www.flightaware.com/live/flight/${encodeURIComponent(arg.toUpperCase())}`, `Flight ${arg.toUpperCase()}`, "FlightAware live flight status")];
  if (name === "mdn") return [redirect(`https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(arg)}`, `MDN: ${arg}`, "Search MDN Web Docs")];
  if (name === "rdap") return validDomain(arg) ? rdap(arg, signal) : [];
  if (name === "ssl") {
    if (!validDomain(arg)) return [];
    const cert = await certificate(arg);
    const issuer = cert.issuer?.CN || cert.issuer?.O || "Unknown issuer";
    return [redirect(`https://www.ssllabs.com/ssltest/analyze.html?d=${encodeURIComponent(arg)}`, `${arg} TLS certificate`, `Issuer: ${issuer} · Valid to: ${cert.valid_to || "unknown"}`)];
  }
  if (name === "mailcheck") {
    const [domain, selector] = arg.split(/\s+/);
    return validDomain(domain) ? mailcheck(domain, selector) : [];
  }
  if (name === "gh") {
    if (!/^[^/\s]+\/[^/\s]+$/.test(arg)) return [];
    const data = await cachedGet(`https://api.github.com/repos/${arg.split("/").map(encodeURIComponent).join("/")}`, 600, { timeout: TIMEOUT, signal });
    return [redirect(`https://github.com/${arg}`, data.full_name || arg, `${data.description || "GitHub repository"} · Stars: ${data.stargazers_count ?? 0}`)];
  }
  const data = await cachedGet(`https://registry.npmjs.org/${encodeURIComponent(arg)}/latest`, 600, { timeout: TIMEOUT, signal });
  return [redirect(`https://www.npmjs.com/package/${arg.split("/").map(encodeURIComponent).join("/")}`, data.name || arg, `${data.version || "latest"} · ${data.description || "npm package"}`)];
}

export function parseGoogleSuggestions(raw: string, query: string, bangSlug?: string): RichSuggestion[] {
  const text = String(raw).replace(/^\)\]\}'\s*/, '');
  const json = text.startsWith("window.google.ac.h(") ? text.slice(text.indexOf("(") + 1, text.lastIndexOf(")")) : text;
  const payload = JSON.parse(json);
  const chrome = typeof payload?.[0] === 'string';
  const items = chrome ? payload[1] : payload?.[0];
  if (!Array.isArray(items)) return [];
  return items.map((item: any, index: number) => {
    const meta = chrome ? payload[4]?.['google:suggestdetail']?.[index] || {} : item[3] || {};
    let entity: EntityInfo | undefined;
    try { if (meta['google:entityinfo']) entity = EntityInfo.fromBinary(new Uint8Array(Buffer.from(meta['google:entityinfo'], 'base64'))); } catch { /* Ignore malformed optional metadata. */ }
    const encoded = meta['google:suggesttemplate'];
    const template = decodeSuggestTemplate(encoded);
    const rawSuggestion = plainText(String(chrome ? item : item[0]));
    const suggestion = bangSlug ? `!${bangSlug} ${rawSuggestion}` : rawSuggestion;
    const annotation = plainText(template?.secondaryText?.text || entity?.annotation || meta.zi || meta.a || '');
    const isPerson = /actor|actress|musician|singer|rapper|politician|athlete|player|director|comedian|model|author/i.test(annotation);
    const explicitType = chrome ? payload[4]?.['google:suggesttype']?.[index] : undefined;
    return {
      suggestion,
      title: plainText(template?.primaryText?.text || entity?.name || meta.zh || suggestion),
      annotation,
      image: template?.image?.url || entity?.imageUrl || meta.zs || meta.i,
      suggestTemplate: template ? encoded : undefined,
      entityInfo: entity ? meta['google:entityinfo'] : undefined,
      subtypes: chrome && Array.isArray(payload[4]?.['google:suggestsubtypes']?.[index]) ? payload[4]['google:suggestsubtypes'][index] : [],
      dominantColor: template?.image?.dominantColor || entity?.dominantColor,
      searchParameters: entity?.suggestSearchParameters,
      categories: entity?.category,
      website: entity?.websiteUri,
      source: 'google' as const,
      type: explicitType || (entity || meta.zi || meta.zs ? (isPerson ? 'PERSON' : 'ENTITY') : 'QUERY'),
      relevance: chrome ? payload[4]?.['google:suggestrelevance']?.[index] || 1300 - index : meta.zi || meta.zs ? 7500 - index : 1300 - index,
    };
  });
}

// Google returns entity metadata only to Chrome-like clients; axios's default User-Agent gets plain queries.
const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

export function googleSuggestUrl(query: string, options: Record<string, unknown> = {}, cursorOffset = 0): string {
  const params = new URLSearchParams();
  params.set('client', 'chrome-omni');
  // Chrome sends this; without it Google omits entity rows, images and annotations ("Troy — 2004 film").
  params.set('gs_ri', 'chrome-ext-ansg');
  params.set('hl', typeof options.hl === 'string' && /^[a-z]{2,3}(?:[-_][a-z0-9]{2,8})*$/i.test(options.hl) ? options.hl : 'en');
  if (typeof options.gl === 'string' && /^[a-z]{2}$/i.test(options.gl)) params.set('gl', options.gl);
  if (typeof options.cp === 'string' && /^\d{1,6}$/.test(options.cp)) params.set('cp', String(Math.min(query.length, Math.max(0, Number(options.cp) - cursorOffset))));
  params.set('q', query);
  return 'https://www.google.com/complete/search?' + params;
}

export async function getGoogleRichSuggestions(query: string, bangSlug?: string, signal?: AbortSignal, options: Record<string, unknown> = {}, cursorOffset = 0): Promise<RichSuggestion[]> {
  if (!query.trim()) return [];
  try {
    const data = await cachedGet(googleSuggestUrl(query, options, cursorOffset), 300, { timeout: 750, signal, responseType: 'text', headers: { 'User-Agent': CHROME_UA } });
    return parseGoogleSuggestions(String(data), query, bangSlug);
  } catch { return []; }
}

export async function getRichSuggestions(query: string, signal?: AbortSignal): Promise<RichSuggestion[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    if (/^![a-z]*$/i.test(q)) return discovery(q.slice(1).toLowerCase());
    const media = q.match(/^(movie|tv)\s+(\S.*)$/i);
    if (media) return await mediaSuggestions(media[1].toLowerCase() as 'movie' | 'tv', media[2], signal);
    const commandResult = await command(q, signal);
    if (commandResult) return commandResult;

    let match = q.match(/^(?:whois|rdap)\s+(\S+)$/i);
    if (match) return validDomain(match[1]) ? await rdap(match[1], signal) : [];
    const urlCommand = q.match(/^url\s+(\S+)$/i);
    if (urlCommand || /^https?:\/\/\S+$/i.test(q)) {
      const input = urlCommand ? urlCommand[1] : q;
      const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
      const parsed = new URL(withScheme);
      return /^https?:$/.test(parsed.protocol) ? await inspectUrl(parsed.toString(), signal) : [];
    }
    match = q.match(/^(CVE-\d{4}-\d{4,})$/i);
    if (match) {
      const id = match[1].toUpperCase();
      const data = await cachedGet(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`, 3600, { timeout: TIMEOUT, signal });
      const details = String(data.details || data.summary || "OSV vulnerability record").replace(/\s+/g, " ").slice(0, 300);
      return [redirect(`https://nvd.nist.gov/vuln/detail/${id}`, `${id}: ${data.summary || "Vulnerability"}`, details)];
    }
    match = q.match(/^(-?(?:\d+\.?\d*|\.\d+))\s*([a-z°]+)\s+(?:(?:to|in)\s+)?([a-z°]+)$/i);
    if (match) {
      const amount = Number(match[1]);
      const converted = convertUnit(amount, match[2], match[3]);
      if (converted !== null) return [answer(q, `${amount} ${match[2].toUpperCase()} = ${converted} ${match[3].toUpperCase()}`, "Unit conversion")];
      if (/^[a-z]{3}$/i.test(match[2]) && /^[a-z]{3}$/i.test(match[3])) {
        const from = match[2].toUpperCase();
        const to = match[3].toUpperCase();
        const data = await cachedGet(`https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`, 3600, { timeout: TIMEOUT, signal });
        if (typeof data.rates?.[to] !== "number") return [];
        return [answer(q, `${amount} ${from} = ${data.rates[to]} ${to}`, `Frankfurter exchange rate · ${data.date || "latest"}`)];
      }
    }
    match = q.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+([a-z/]+)\s+(?:to\s+)?([a-z/]+)$/i);
    if (match) {
      let hour = Number(match[1]);
      const minute = Number(match[2] || 0);
      const source = zoneFor(match[4]);
      const target = zoneFor(match[5]);
      if (!source || !target || minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return [];
      if (match[3]?.toLowerCase() === "pm" && hour < 12) hour += 12;
      if (match[3]?.toLowerCase() === "am" && hour === 12) hour = 0;
      const converted = convertTime(hour, minute, source, target);
      const formatted = new Intl.DateTimeFormat("en-US", { timeZone: target, dateStyle: "medium", timeStyle: "short" }).format(converted);
      return [answer(q, formatted, `${source} → ${target}`)];
    }
    match = q.match(/^time\s+(.+)$/i);
    if (match) {
      const zone = zoneFor(match[1].trim());
      if (!zone) return [];
      const formatted = new Intl.DateTimeFormat("en-US", { timeZone: zone, dateStyle: "medium", timeStyle: "long" }).format(new Date());
      return [answer(q, formatted, zone)];
    }
    const isbn = q.replace(/^isbn[:\s]*/i, "").replace(/[\s-]/g, "");
    if (validIsbn(isbn)) return [redirect(`https://isbnsearch.org/isbn/${isbn}`, `ISBN ${isbn}`, "Look up this book on ISBNSearch")];
    if (/^\d{10}(?:\d{3})?$/.test(q)) {
      const date = new Date(Number(q) * (q.length === 10 ? 1000 : 1));
      return [answer(q, date.toUTCString(), date.toISOString())];
    }
    const color = hexToRgbHsl(q);
    if (color) return [{ ...redirect(`https://coolors.co/${color.hex.slice(1)}`, `${color.hex} · rgb(${color.rgb.join(", ")})`, `hsl(${color.hsl[0]}, ${color.hsl[1]}%, ${color.hsl[2]}%)`), image: `/color/${color.hex.slice(1)}.svg` }];
    match = q.match(/^urlencode\s+(.+)$/i);
    if (match) return [answer(encodeURIComponent(match[1]), encodeURIComponent(match[1]), "URL-encoded text")];
    match = q.match(/^base64\s+(encode|decode)\s+(.+)$/i);
    if (match) {
      const output = match[1].toLowerCase() === "encode" ? Buffer.from(match[2]).toString("base64") : Buffer.from(match[2], "base64").toString("utf8");
      return [answer(output, output, `Base64 ${match[1].toLowerCase()}`)];
    }
    if (/^uuid$/i.test(q)) {
      const id = randomUUID();
      return [answer(id, id, "Random UUID v4")];
    }
    match = q.match(/^(?:doi\s+)?(10\.\d{4,9}\/\S+)$/i);
    if (match) return [redirect(`https://doi.org/${encodeURI(match[1])}`, `DOI ${match[1]}`, "Resolve DOI")];
    match = q.match(/^arxiv:\s*(\S+)$/i);
    if (match) return [redirect(`https://arxiv.org/abs/${encodeURI(match[1])}`, `arXiv:${match[1]}`, "Open abstract on arXiv")];
    return [];
  } catch {
    return [];
  }
}
