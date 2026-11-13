/* Emu Search prototype engine: fixture data and suggestion logic shared by all three design options.
   Plain JS with types in engine.d.ts. Rendering lives in the React components.
   No network calls. Everything below is illustrative fixture data, not live results. */
  const SEARCH = 'https://search.emu.sh/search?q=';
  const Q = '~QUERYHERE~';

  /* ---------- bangs (persistent, editable) ---------- */
  const DEFAULT_BANGS = [
    { name: 'public', aliases: ['pub'], url: `https://github.com/section/${Q}`, description: 'Section GitHub org search' },
    { name: 'redirect', aliases: [], url: Q, description: 'Redirect to URL' },
    { name: 'ebo', aliases: ['ebayorders'], url: `https://www.ebay.com/mye/myebay/v2/purchase?q=${Q}`, description: 'eBay orders' },
    { name: 'orders', aliases: ['o'], url: `https://www.amazon.com/gp/your-account/order-history?search=${Q}`, description: 'Amazon orders' },
  ];
  const DDG_BANGS = [
    ['g', 'Google', `https://www.google.com/search?q=${Q}`], ['w', 'Wikipedia', `https://en.wikipedia.org/wiki/Special:Search?search=${Q}`],
    ['gh', 'GitHub', `https://github.com/search?q=${Q}`], ['yt', 'YouTube', `https://www.youtube.com/results?search_query=${Q}`],
    ['a', 'Amazon', `https://www.amazon.com/s?k=${Q}`], ['mdn', 'MDN Web Docs', `https://developer.mozilla.org/en-US/search?q=${Q}`],
    ['npm', 'npm', `https://www.npmjs.com/search?q=${Q}`], ['so', 'Stack Overflow', `https://stackoverflow.com/search?q=${Q}`],
    ['maps', 'OpenStreetMap', `https://www.openstreetmap.org/search?query=${Q}`],
  ];
  const KEY = 'emu-prototype-bangs';
  const clone = v => JSON.parse(JSON.stringify(v));
  let memory = null;
  function loadBangs() {
    if (memory) return clone(memory);
    try { const raw = localStorage.getItem(KEY); if (raw) return (memory = validateBangs(JSON.parse(raw))), clone(memory); } catch { /* sandboxed or corrupt: fall through */ }
    return clone(DEFAULT_BANGS);
  }
  function saveBangs(list) {
    memory = validateBangs(list);
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* storage blocked: kept for this page only */ }
    return clone(memory);
  }
  /* Mirrors the server rules in src/suggestions.ts. Throws Error with .index of the offending bang. */
  function validateBangs(list) {
    const fail = (message, index) => { throw Object.assign(new Error(message), { index }); };
    if (!Array.isArray(list) || list.length > 20) fail('Use at most 20 custom bangs.', -1);
    const used = new Set();
    return list.map((item, index) => {
      const name = String(item.name || '').trim().toLowerCase();
      const aliases = [...new Set((item.aliases || []).map(a => String(a).trim().toLowerCase()).filter(a => a && a !== name))];
      for (const alias of [name, ...aliases]) {
        if (!/^[a-z0-9_-]{1,32}$/.test(alias)) fail(`Bang ${index + 1}: names and aliases use letters, numbers, _ or - (1 to 32 characters).`, index);
        if (used.has(alias)) fail(`Bang ${index + 1}: “!${alias}” is already used by another bang.`, index);
        used.add(alias);
      }
      const url = String(item.url || '').trim();
      if (url !== Q && !/^https?:\/\/\S+$/i.test(url)) fail(`Bang ${index + 1}: the URL must start with http:// or https://.`, index);
      if (url.length > 1000) fail(`Bang ${index + 1}: the URL is too long.`, index);
      const description = String(item.description || '').trim();
      if (description.length > 120) fail(`Bang ${index + 1}: keep the description under 120 characters.`, index);
      return { name, aliases, url, description };
    });
  }
  const bangUrl = (url, query) => (url === Q ? query : url.split(Q).join(encodeURIComponent(query)));
  const host = url => { try { return new URL(url).host.replace(/^www\./, ''); } catch { return 'any URL'; } };

  /* ---------- inline art ---------- */
  const svg = (body, vb = '0 0 64 64') => `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
  const stroke = d => svg(`<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</g>`, '0 0 24 24');
  const ICON = {
    web: stroke('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
    answer: stroke('<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 8h7M8.5 12.5h1M12 12.5h1M15.5 12.5h0M8.5 16h1M12 16h3.5"/>'),
    network: stroke('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5S9.400 5.900 12 3.500Z"/>'),
    money: stroke('<circle cx="12" cy="12" r="8.5"/><path d="M14.800 9.200c-.5-1-1.500-1.500-2.800-1.500-1.700 0-2.900.8-2.900 2.100 0 3 5.900 1.300 5.900 4.400 0 1.300-1.300 2.100-3 2.100-1.400 0-2.500-.6-3-1.600M12 5.800v12.400"/>'),
    media: stroke('<rect x="3.5" y="5" width="17" height="14" rx="2.500"/><path d="m10.200 9.300 4.600 2.700-4.600 2.700Z"/>'),
    dev: stroke('<path d="m8.500 8-4.500 4 4.500 4M15.500 8l4.500 4-4.500 4M13.300 5.500l-2.600 13"/>'),
    bang: stroke('<path d="M12 4v10.500"/><circle cx="12" cy="19" r=".6" fill="currentColor"/>'),
    entity: stroke('<path d="M12 3.500l2.500 5.300 5.800.7-4.300 4 1.100 5.700L12 16.400l-5.100 2.800L8 13.500l-4.300-4 5.800-.7Z"/>'),
  };
  const ART = {
    emu: svg('<rect width="64" height="64" fill="#dfe9e4"/><path d="M0 50c14-7 26-7 38-2s18 3 26-1v17H0Z" fill="#b9cdbf"/><ellipse cx="27" cy="37" rx="15" ry="10.500" fill="#4a3f38"/><path d="M13 34c-4 3-5 8-3 12 3-4 7-6 12-6Z" fill="#3a302b"/><path d="M38 33c4-5 5-11 5-17" fill="none" stroke="#5f6f7a" stroke-width="4.500" stroke-linecap="round"/><circle cx="43.500" cy="14" r="4.300" fill="#3f4d57"/><path d="M47 12.500l7 2-7 1.800Z" fill="#2a2420"/><circle cx="44.600" cy="13.200" r="1" fill="#f3c98b"/><path d="M24 46l-2 12m-3 0h6M31 46l3 12m-3 0h6" fill="none" stroke="#6b5b4d" stroke-width="2" stroke-linecap="round"/>'),
    ada: svg('<rect width="64" height="64" fill="#2c3550"/><circle cx="32" cy="25" r="10.500" fill="#e8d2bd"/><path d="M19 27c-2-12 5-19 13-19s15 7 13 19c-2-7-6-10-13-10s-11 3-13 10Z" fill="#3b2a24"/><path d="M12 64c1-14 9-21 20-21s19 7 20 21Z" fill="#8a3f55"/><path d="M26 44h12l-6 8Z" fill="#f1e6da"/>'),
    egg: svg('<rect width="64" height="64" fill="#e9e4d6"/><ellipse cx="32" cy="34" rx="15" ry="20" fill="#1f4d4a"/><ellipse cx="26" cy="25" rx="4" ry="7" fill="#3f7772" opacity=".7"/>'),
    dune: svg('<defs><linearGradient id="du" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3b46b"/><stop offset="1" stop-color="#c8562c"/></linearGradient></defs><rect width="64" height="96" fill="url(#du)"/><circle cx="44" cy="26" r="9" fill="#fbe3b5"/><circle cx="50" cy="20" r="3.500" fill="#fbe3b5" opacity=".7"/><path d="M0 62c16-12 30-12 44-4s16 6 20 4v34H0Z" fill="#8a3418"/><path d="M0 76c14-8 28-6 40 0s18 4 24 0v20H0Z" fill="#5c1f10"/><path d="M30 68v6" stroke="#2a0d06" stroke-width="1.600" stroke-linecap="round"/>', '0 0 64 96'),
    dune2: svg('<rect width="64" height="96" fill="#1d2433"/><circle cx="32" cy="34" r="17" fill="#e98a3c"/><circle cx="32" cy="34" r="17" fill="none" stroke="#f6c98a" stroke-width="1"/><path d="M0 60c18-10 40-10 64 0v36H0Z" fill="#b4612c"/><path d="M0 74c20-8 42-8 64 2v20H0Z" fill="#6e3317"/><path d="M12 70q10-8 20 0t20 0" fill="none" stroke="#f6c98a" stroke-width="1.400"/>', '0 0 64 96'),
    severance: svg('<rect width="64" height="96" fill="#dfe7e4"/><path d="M0 0l22 30v36L0 96ZM64 0 42 30v36l22 30Z" fill="#c3d0cc"/><rect x="22" y="30" width="20" height="36" fill="#f6f9f8"/><path d="M0 96l22-30h20l22 30Z" fill="#2f6f5e"/><rect x="29" y="44" width="6" height="22" fill="#1e3d5a"/><circle cx="32" cy="41" r="2.600" fill="#1e3d5a"/>', '0 0 64 96'),
    andor: svg('<rect width="64" height="96" fill="#141b2b"/><path d="M0 70l14-18 10 8 12-22 12 16 16-10v52H0Z" fill="#33415c"/><path d="M0 82l18-10 14 6 16-10 16 8v20H0Z" fill="#1f2a3f"/><circle cx="46" cy="22" r="6" fill="#d9a441"/><circle cx="16" cy="14" r="1" fill="#fff"/><circle cx="30" cy="26" r=".8" fill="#fff"/><circle cx="54" cy="40" r=".8" fill="#fff"/>', '0 0 64 96'),
  };

  /* ---------- fixtures ---------- */
  const ENTITIES = [
    { name: 'emu', label: 'Emu', sub: 'Flightless bird', art: 'emu', text: 'The emu is the second-tallest living bird, native to Australia. It can sprint at 48 km/h and its eggs are a deep green.', rows: [['Scientific name', 'Dromaius novaehollandiae'], ['Height', '1.5 to 1.9 m'], ['Top speed', '48 km/h']] },
    { name: 'emu egg', label: 'Emu egg', sub: 'Egg of the emu', art: 'egg', text: 'Emu eggs are dark green, weigh about 500 g, and are incubated by the male for roughly eight weeks.', rows: [['Mass', '450 to 650 g'], ['Incubation', '56 days']] },
    { name: 'ada lovelace', label: 'Ada Lovelace', sub: 'English mathematician', art: 'ada', text: 'Augusta Ada King, Countess of Lovelace, wrote the first published algorithm intended for a machine, Babbage’s Analytical Engine.', rows: [['Born', '10 December 1815, London'], ['Died', '27 November 1852'], ['Known for', 'Notes on the Analytical Engine']] },
  ];
  const MEDIA = [
    { kind: 'movie', title: 'Dune', year: '2021', art: 'dune', score: 7.8, sub: 'Science fiction, 2 h 35 min', text: 'Paul Atreides arrives on Arrakis, the only source of the most valuable substance in the universe.', rows: [['Director', 'Denis Villeneuve'], ['Runtime', '2 h 35 min']] },
    { kind: 'movie', title: 'Dune: Part Two', year: '2024', art: 'dune2', score: 8.1, sub: 'Science fiction, 2 h 46 min', text: 'Paul unites with the Fremen while seeking revenge against those who destroyed his family.', rows: [['Director', 'Denis Villeneuve'], ['Runtime', '2 h 46 min']] },
    { kind: 'tv', title: 'Severance', year: '2022', art: 'severance', score: 8.4, sub: 'Drama, 2 seasons', text: 'Office workers have their memories surgically divided between work and personal lives.', rows: [['Creator', 'Dan Erickson'], ['Seasons', '2']] },
    { kind: 'tv', title: 'Andor', year: '2022', art: 'andor', score: 8.3, sub: 'Science fiction, 2 seasons', text: 'A thief becomes a revolutionary in the early days of the rebellion against the Empire.', rows: [['Creator', 'Tony Gilroy'], ['Seasons', '2']] },
  ];
  const DNS = {
    'emu.sh': { A: ['76.76.21.21'], AAAA: ['2606:4700:3033::6815:1a2b'], MX: ['10 mx1.emu.sh', '20 mx2.emu.sh'], NS: ['ns1.vercel-dns.com', 'ns2.vercel-dns.com'], TXT: ['v=spf1 include:_spf.emu.sh ~all'] },
    'example.com': { A: ['93.184.215.14'], AAAA: ['2606:2800:21f:cb07:6820:80da:af6b:8b2c'], MX: ['0 .'], NS: ['a.iana-servers.net', 'b.iana-servers.net'], TXT: ['v=spf1 -all'] },
  };
  const IPS = { '8.8.8.8': ['Mountain View, California', 'United States', 'Google LLC', 'AS15169'], '1.1.1.1': ['Sydney, New South Wales', 'Australia', 'Cloudflare, Inc.', 'AS13335'], '9.9.9.9': ['Berkeley, California', 'United States', 'Quad9', 'AS19281'] };
  const COINS = { btc: ['Bitcoin', 97420.5, [91, 93, 92, 95, 94, 96, 97.4]], eth: ['Ethereum', 3412.18, [3.6, 3.5, 3.45, 3.3, 3.38, 3.36, 3.41]], sol: ['Solana', 188.42, [171, 176, 174, 181, 186, 184, 188]], xmr: ['Monero', 162.9, [158, 160, 157, 161, 163, 164, 162.9]], doge: ['Dogecoin', 0.3521, [0.33, 0.34, 0.36, 0.35, 0.34, 0.35, 0.352]] };
  const FX = { usd: 1, eur: 0.9234, gbp: 0.7891, jpy: 153.42, cad: 1.3987, aud: 1.5312 };
  const UNITS = { mm: ['l', 0.001], cm: ['l', 0.01], m: ['l', 1], km: ['l', 1000], in: ['l', 0.0254], ft: ['l', 0.3048], yd: ['l', 0.9144], mi: ['l', 1609.344], g: ['m', 0.001], kg: ['m', 1], oz: ['m', 0.028349523], lb: ['m', 0.45359237] };
  const DEV = {
    'npm react': { title: 'react', sub: 'npm package', big: '19.2.0', rows: [['License', 'MIT'], ['Weekly downloads', '48.1 M'], ['Published', '6 weeks ago']], url: 'https://www.npmjs.com/package/react' },
    'npm fastify': { title: 'fastify', sub: 'npm package', big: '5.6.1', rows: [['License', 'MIT'], ['Weekly downloads', '3.4 M'], ['Published', '3 weeks ago']], url: 'https://www.npmjs.com/package/fastify' },
    'gh vercel/next.js': { title: 'vercel/next.js', sub: 'GitHub repository', big: '136 k stars', rows: [['Language', 'JavaScript, Rust'], ['Open issues', '3,214'], ['License', 'MIT']], url: 'https://github.com/vercel/next.js' },
    'gh askalice/search.emu.sh': { title: 'AskAlice/search.emu.sh', sub: 'GitHub repository', big: 'TypeScript', rows: [['About', 'Rich omnibox suggestions and custom bangs'], ['License', 'MIT']], url: 'https://github.com/AskAlice/search.emu.sh' },
    'cve-2021-44228': { title: 'CVE-2021-44228', sub: 'Log4Shell, Apache Log4j 2', big: 'CVSS 10.0', rows: [['Severity', 'Critical'], ['Type', 'Remote code execution via JNDI lookup'], ['Fixed in', 'Log4j 2.17.1']], url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-44228' },
  };
  const PHRASES = ['emu', 'emu egg', 'emu vs ostrich', 'emu war 1932', 'emulator for linux', 'ada lovelace', 'ada lovelace day', 'dune part two cast', 'dune reading order', 'dns over https', 'dns propagation check', 'severance season 3', 'fastify vs express', 'fastify plugins', 'react 19 release notes', 'react compiler', 'bitcoin halving date', 'weather sydney', 'what is my ip', 'how tall is an emu', 'unix timestamp now', 'usd to eur', 'chrome search engine shortcuts', 'duckduckgo bangs list'];
  const EXAMPLES = [
    { cat: 'answer', title: 'Rich answers', items: [['emu', 'Entity card with image'], ['ada lovelace', 'Person card'], ['5 ft in cm', 'Unit conversion'], ['100 usd eur', 'Currency conversion'], ['(12.5 + 7) * 3', 'Calculator'], ['1730000000', 'Unix timestamp'], ['#de5833', 'Color conversion']] },
    { cat: 'network', title: 'Network and web', items: [['emu.sh', 'DNS A records'], ['dig emu.sh MX', 'DNS records by type'], ['mailcheck emu.sh', 'MX, SPF, and DMARC'], ['ssl emu.sh', 'TLS certificate'], ['8.8.8.8', 'IP geolocation']] },
    { cat: 'dev', title: 'Developer', items: [['npm react', 'npm package metadata'], ['gh vercel/next.js', 'GitHub repository'], ['CVE-2021-44228', 'Vulnerability details'], ['base64 encode hello', 'Base64 encoding'], ['uuid', 'Random UUID']] },
    { cat: 'media', title: 'Movies, TV, and crypto', items: [['movie dune', 'Movies from TMDB'], ['tv severance', 'TV shows from TMDB'], ['5 btc', 'Crypto price'], ['2 eth', 'Crypto price']] },
    { cat: 'bang', title: 'Bangs', items: [['!', 'Browse your custom bangs'], ['!orders usb-c cable', 'Custom bang'], ['!gh fastify', 'DuckDuckGo bang']] },
  ];
  const CAT_LABEL = { web: 'Search', answer: 'Answer', network: 'Network', money: 'Money', media: 'Film and TV', dev: 'Developer', bang: 'Bang', entity: 'Knowledge' };

  /* ---------- calculators ---------- */
  const fmt = (n, d = 6) => Number.isFinite(n) ? Number(n.toFixed(d)).toLocaleString('en-US', { maximumFractionDigits: d }) : 'undefined';
  function calc(src) {
    let i = 0;
    const ws = () => { while (src[i] === ' ') i++; };
    const atom = () => {
      ws();
      if (src[i] === '(') { i++; const v = sum(); ws(); if (src[i++] !== ')') throw 0; return v; }
      if (src[i] === '-') { i++; return -atom(); }
      const m = /^\d+(\.\d+)?|^\.\d+/.exec(src.slice(i));
      if (!m) throw 0;
      i += m[0].length; return parseFloat(m[0]);
    };
    const pow = () => { const b = atom(); ws(); if (src[i] === '^') { i++; return b ** pow(); } return b; };
    const prod = () => { let v = pow(); for (;;) { ws(); const o = src[i]; if (o !== '*' && o !== '/' && o !== '%') return v; i++; const r = pow(); v = o === '*' ? v * r : o === '/' ? v / r : v % r; } };
    const sum = () => { let v = prod(); for (;;) { ws(); const o = src[i]; if (o !== '+' && o !== '-') return v; i++; const r = prod(); v = o === '+' ? v + r : v - r; } };
    const v = sum(); ws(); if (i < src.length) throw 0; return v;
  }
  function hexColor(hex) {
    const [r, g, b] = [1, 3, 5].map(o => parseInt(hex.slice(o, o + 2), 16));
    const [x, y, z] = [r / 255, g / 255, b / 255], max = Math.max(x, y, z), min = Math.min(x, y, z), l = (max + min) / 2, d = max - min;
    const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    const h = !d ? 0 : max === x ? ((y - z) / d + 6) % 6 : max === y ? (z - x) / d + 2 : (x - y) / d + 4;
    return { rgb: `rgb(${r}, ${g}, ${b})`, hsl: `hsl(${Math.round(h * 60)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)` };
  }
  const item = (cat, kind, title, o = {}) => ({ cat, kind, title, tag: CAT_LABEL[cat], icon: ICON[cat], value: title, ...o });

  /* ---------- suggest ---------- */
  function suggest(input, bangs = loadBangs()) {
    const raw = input.trim(), q = raw.toLowerCase(), out = [];
    if (!raw) return out;
    let m;

    if (raw[0] === '!') {
      const [, name = '', rest = ''] = /^!(\S*)\s*(.*)$/.exec(q) || [];
      const restRaw = raw.replace(/^!\S*\s*/, '');
      const custom = bangs.map(b => ({ ...b, keys: [b.name, ...b.aliases], source: 'Custom bang' }));
      const ddg = DDG_BANGS.map(([n, d, url]) => ({ name: n, keys: [n], aliases: [], url, description: d, source: 'DuckDuckGo bang' }));
      const all = [...custom, ...ddg.filter(d => !custom.some(c => c.keys.includes(d.name)))];
      const exact = all.find(b => b.keys.includes(name));
      if (exact && (rest || /\s$/.test(input))) {
        const url = rest ? bangUrl(exact.url, restRaw) : null;
        out.push(item('bang', 'bang', rest ? `${exact.description || '!' + exact.name}: ${restRaw}` : `!${exact.name}`, {
          sub: rest ? `Opens ${host(url)}` : `Type a query for ${exact.description || host(exact.url)}`, tag: exact.source, bang: exact.name,
          value: `!${exact.name} ${restRaw}`, url, fill: !rest, rows: [['Shortcut', [exact.name, ...exact.aliases].map(a => '!' + a).join(', ')], ['Template', exact.url], ['Goes to', url || 'Waiting for a query']],
        }));
        return out;
      }
      for (const b of all.filter(b => b.keys.some(k => k.startsWith(name))).slice(0, 8)) {
        out.push(item('bang', 'bang', `!${b.name}`, { sub: b.description || host(b.url), tag: b.source, bang: b.name, value: `!${b.name} `, fill: true, rows: [['Shortcut', b.keys.map(a => '!' + a).join(', ')], ['Template', b.url]] }));
      }
      if (!out.length) out.push(item('bang', 'bang', `!${name}`, { sub: 'No custom bang with this name. DuckDuckGo will handle it.', tag: 'DuckDuckGo bang', url: `https://duckduckgo.com/?q=${encodeURIComponent(raw)}`, rows: [['Handled by', 'duckduckgo.com']] }));
      return out;
    }

    if ((m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(q)) && m.slice(1).every(n => n < 256)) {
      const priv = /^(10\.|192\.168\.|127\.|172\.(1[6-9]|2\d|3[01])\.)/.test(q);
      const [city, country, org, asn] = IPS[q] || (priv ? ['Private network', 'Not routable on the internet', 'RFC 1918 or loopback', 'None'] : ['Frankfurt am Main, Hesse', 'Germany', 'Fixture Networks GmbH', 'AS64500']);
      out.push(item('network', 'ip', q, { sub: `${city}, ${country}`, big: city, rows: [['Country', country], ['Organization', org], ['ASN', asn]], url: `https://ipinfo.io/${q}` }));
    } else if ((m = /^(?:(dig|whois|ssl|mailcheck)\s+)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:\s+(a|aaaa|mx|ns|txt))?$/.exec(q)) && /[a-z]/.test(m[2].split('.').pop())) {
      const [, tool = 'dig', domain, typeRaw] = m, type = (typeRaw || 'a').toUpperCase();
      const rec = DNS[domain] || { A: ['203.0.113.42'], AAAA: ['2001:db8::2a'], MX: [`10 mail.${domain}`], NS: [`ns1.${domain}`, `ns2.${domain}`], TXT: ['v=spf1 -all'] };
      if (tool === 'whois') out.push(item('network', 'dns', `whois ${domain}`, { sub: 'RDAP registration', big: 'Registered', rows: [['Registrar', 'Fixture Registrar, Inc.'], ['Created', '2019-03-14'], ['Expires', '2027-03-14'], ['Nameservers', rec.NS.join(', ')]], url: `https://rdap.org/domain/${domain}` }));
      else if (tool === 'ssl') out.push(item('network', 'dns', `ssl ${domain}`, { sub: 'TLS certificate', big: 'Valid for 61 days', rows: [['Issuer', 'Let’s Encrypt R11'], ['Subject', domain], ['Expires', '2027-01-12'], ['Protocol', 'TLS 1.3']], url: `https://${domain}` }));
      else if (tool === 'mailcheck') out.push(item('network', 'dns', `mailcheck ${domain}`, { sub: 'MX, SPF, and DMARC', big: 'Mail is configured', rows: [['MX', rec.MX.join(', ')], ['SPF', rec.TXT[0]], ['DMARC', 'v=DMARC1; p=quarantine']], url: `https://${domain}` }));
      else out.push(item('network', 'dns', `${domain} ${type}`, { sub: `${rec[type].length} ${type} record${rec[type].length === 1 ? '' : 's'}`, big: rec[type][0], value: `dig ${domain} ${type}`, rows: rec[type].map(r => [type, r]).concat([['TTL', '300 s']]), url: `https://${domain}` }));
    } else if ((m = /^(\d+(?:\.\d+)?)\s*(btc|eth|sol|xmr|doge)$/.exec(q))) {
      const [name, price, trend] = COINS[m[2]], total = m[1] * price;
      out.push(item('money', 'crypto', `${m[1]} ${m[2].toUpperCase()}`, { sub: `${name} in US dollars`, big: `$${fmt(total, 2)}`, spark: trend, rows: [['1 ' + m[2].toUpperCase(), `$${fmt(price, 4)}`], ['7 day change', `${((trend[6] / trend[0] - 1) * 100).toFixed(1)}%`]], url: `https://coinmarketcap.com/currencies/${name.toLowerCase()}/` }));
    } else if ((m = /^(\d+(?:\.\d+)?)\s*(usd|eur|gbp|jpy|cad|aud)\s+(?:to\s+|in\s+)?(usd|eur|gbp|jpy|cad|aud)$/.exec(q))) {
      const v = m[1] / FX[m[2]] * FX[m[3]];
      out.push(item('money', 'calc', `${m[1]} ${m[2].toUpperCase()} to ${m[3].toUpperCase()}`, { sub: 'Currency conversion', big: `${fmt(v, 2)} ${m[3].toUpperCase()}`, rows: [['Rate', `1 ${m[2].toUpperCase()} = ${fmt(FX[m[3]] / FX[m[2]], 4)} ${m[3].toUpperCase()}`]], url: SEARCH + encodeURIComponent(raw) }));
    } else if ((m = /^(-?\d+(?:\.\d+)?)\s*([a-z]+)\s+(?:in|to)\s+([a-z]+)$/.exec(q)) && UNITS[m[2]] && UNITS[m[3]] && UNITS[m[2]][0] === UNITS[m[3]][0]) {
      const v = m[1] * UNITS[m[2]][1] / UNITS[m[3]][1];
      out.push(item('answer', 'calc', `${m[1]} ${m[2]} in ${m[3]}`, { sub: 'Unit conversion', big: `${fmt(v, 4)} ${m[3]}`, rows: [['Factor', `1 ${m[2]} = ${fmt(UNITS[m[2]][1] / UNITS[m[3]][1], 6)} ${m[3]}`]], url: SEARCH + encodeURIComponent(raw) }));
    } else if (/^#[0-9a-f]{6}$/.test(q)) {
      const c = hexColor(q);
      out.push(item('answer', 'color', q, { sub: 'Color conversion', big: c.rgb, swatch: q, rows: [['HEX', q], ['RGB', c.rgb], ['HSL', c.hsl]], url: SEARCH + encodeURIComponent(raw) }));
    } else if (/^\d{10}$/.test(q)) {
      const d = new Date(q * 1000);
      out.push(item('answer', 'calc', q, { sub: 'Unix timestamp', big: d.toISOString().replace('T', ' ').replace('.000Z', ' UTC'), rows: [['ISO 8601', d.toISOString()], ['Milliseconds', String(q * 1000)]], url: SEARCH + q }));
    } else if (/^[\d\s+\-*/().%^]+$/.test(q) && /\d\s*[+\-*/%^]\s*[\d(.-]/.test(q)) {
      try { const v = calc(q); out.push(item('answer', 'calc', raw, { sub: 'Calculator', big: `= ${fmt(v, 8)}`, url: SEARCH + encodeURIComponent(raw) })); } catch { /* incomplete expression: no answer yet */ }
    } else if (q === 'uuid') {
      const id = globalThis.crypto?.randomUUID?.() || '3f2b8c1e-7a4d-4e9b-9c55-0d1e2f3a4b5c';
      out.push(item('dev', 'calc', 'uuid', { sub: 'Random UUID v4', big: id, url: SEARCH + 'uuid' }));
    } else if ((m = /^base64 encode (.+)$/i.exec(raw))) {
      out.push(item('dev', 'calc', raw, { sub: 'Base64 encoding', big: btoa(unescape(encodeURIComponent(m[1]))), url: SEARCH + encodeURIComponent(raw) }));
    } else if ((m = /^urlencode (.+)$/i.exec(raw))) {
      out.push(item('dev', 'calc', raw, { sub: 'URL encoding', big: encodeURIComponent(m[1]), url: SEARCH + encodeURIComponent(raw) }));
    } else if ((m = /^(movie|tv)\s+(.+)$/.exec(q))) {
      for (const t of MEDIA.filter(t => t.kind === m[1] && t.title.toLowerCase().includes(m[2]))) {
        out.push(item('media', 'media', `${t.title} (${t.year})`, { sub: t.sub, text: t.text, art: ART[t.art], poster: true, score: t.score, tag: t.kind === 'tv' ? 'TV show' : 'Movie', value: `${m[1]} ${t.title.toLowerCase()}`, rows: [...t.rows, ['TMDB score', `${t.score} / 10`]], url: `https://www.themoviedb.org/search?query=${encodeURIComponent(t.title)}` }));
      }
    } else if (DEV[q]) {
      const d = DEV[q];
      out.push(item('dev', 'dev', d.title, { ...d, value: raw }));
    }

    if (q.length >= 2) for (const e of ENTITIES.filter(e => e.name.startsWith(q))) {
      out.push(item('entity', 'entity', e.label, { sub: e.sub, text: e.text, art: ART[e.art], rows: e.rows, value: e.name, url: SEARCH + encodeURIComponent(e.name) }));
    }
    if (!out.length || out[0].kind === 'entity') {
      for (const key of Object.keys(DEV).filter(k => k.startsWith(q) && k !== q).slice(0, 2)) out.push(item('dev', 'dev', key, { sub: DEV[key].sub, value: key, fill: true }));
    }
    const seen = new Set(out.map(o => o.value.toLowerCase()));
    for (const p of PHRASES.filter(p => p.startsWith(q) && !seen.has(p)).concat(PHRASES.filter(p => !p.startsWith(q) && p.includes(q)))) {
      if (out.length >= 7) break;
      out.push(item('web', 'query', p, { url: SEARCH + encodeURIComponent(p) }));
    }
    if (!seen.has(q) && !out.some(o => o.kind === 'query' && o.title === q)) out.push(item('web', 'query', raw, { sub: 'Search the web', url: SEARCH + encodeURIComponent(raw) }));
    return out;
  }

  /* ---------- install guidance ---------- */
  const BROWSERS = [['chrome', 'Google Chrome'], ['chromium', 'Chromium'], ['brave', 'Brave'], ['brave-origin', 'Brave Origin'], ['edge', 'Microsoft Edge'], ['vivaldi', 'Vivaldi'], ['arc', 'Arc'], ['opera', 'Opera']];
  const SCRIPT = 'scripts/install-chromium-search.py';
  function installPlan({ os = 'linux', browser = 'chrome', profile = 'Default' } = {}) {
    const py = os === 'windows' ? 'py -3' : 'python3';
    const name = (profile.trim() || 'Default').replace(/'/g, '');
    const arg = /^[\w.-]+$/.test(name) ? name : `'${name}'`;
    const backups = { macos: '~/Library/Application Support/emu-search/backups/', linux: '~/.local/share/emu-search/backups/', windows: '%LOCALAPPDATA%\\emu-search\\backups\\' }[os];
    const manifest = os === 'windows' ? 'C:\\path\\to\\manifest.json' : '/path/printed/by/installer/manifest.json';
    return {
      list: `${py} ${SCRIPT} --list`,
      install: `${py} ${SCRIPT} --browser ${browser} --profile ${arg}`,
      restore: `${py} ${SCRIPT} --restore '${manifest}'`,
      backups,
      note: os === 'linux' ? 'Linux needs lsof. Install it with your package manager, then run as your normal user, without sudo.' : os === 'windows' ? 'Run in PowerShell as your normal user. No extra Python packages are needed.' : 'Run in Terminal as your normal user, without sudo.',
      unsupported: browser === 'arc' && os === 'linux' ? 'Arc is not available on Linux. Pick another browser.' : '',
    };
  }
  const SQL = `INSERT INTO "keywords" ("id", "short_name", "keyword", "favicon_url", "url", "safe_for_autoreplace", "originating_url", "date_created", "usage_count", "input_encodings", "suggest_url", "prepopulate_id", "created_by_policy", "last_modified", "sync_guid", "alternate_urls", "image_url", "search_url_post_params", "suggest_url_post_params", "image_url_post_params", "new_tab_url", "last_visited", "created_from_play_api")
VALUES (8195,
'emu search',
'emu',
'https://emu.sh/favicon.ico',
'https://search.emu.sh/search?q={searchTerms}',
0,
'https://search.emu.sh/osd.xml',
13265769204726412,
4,
'UTF-8',
'https://search.emu.sh/suggest?client=chrome-omni&q={searchTerms}',
0,
0,
13270754999736713,
'2f79ed5e-e746-4052-ab15-c5dcae786063',
'[]', '', '', '', '', '',
13273967198571427,
0);`;


export { suggest, loadBangs, saveBangs, validateBangs, installPlan, host, ICON, ART, EXAMPLES, CAT_LABEL, DEFAULT_BANGS, BROWSERS, SQL, SEARCH };
