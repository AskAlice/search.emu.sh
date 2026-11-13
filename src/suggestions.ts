function Suggestion(name: string, aliases: string[], url: string, favicon: string, description: string) {
  this.name = name;
  this.aliases = aliases;
  this.aliases.unshift(name);
  this.url = url;
  this.favicon = favicon;
  this.description = description;
}

const suggestions = [];
const search = `~QUERYHERE~`;
suggestions.push(new Suggestion("public", ["pub"], `https://github.com/section/${search}`, "github.png", "Section Github Org Search"));
suggestions.push(new Suggestion("redirect", [], `${search}`, "redirect.png", "redirect to url"));
suggestions.push(
  new Suggestion(
    "ebo",
    ["ebayorders"],
    `https://www.ebay.com/mye/myebay/v2/purchase?page=1&q=${search}&mp=purchase-search-module-v2&type=v2&pg=purchase`,
    "ebay.png",
    "ebay orders"
  )
);
suggestions.push(
  new Suggestion(
    "orders",
    ["o"],
    `https://smile.amazon.com/gp/your-account/order-history/ref=ppx_yo_dt_b_search?opt=ab&search=${search}`,
    "amazon-32.jpg",
    "Amazon Orders"
  )
);

export default suggestions;

export type CustomBang = { name: string; aliases: string[]; url: string; favicon: string; description: string };
export const BANG_COOKIE = 'emu_bangs';

export function validateBangs(value: unknown): CustomBang[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error('Use at most 20 custom bangs.');
  const used = new Set<string>();
  return value.map(item => {
    if (!item || typeof item.name !== 'string' || !Array.isArray(item.aliases) ||
        typeof item.url !== 'string' || typeof item.description !== 'string') throw new Error('Invalid bang fields.');
    const name = item.name.trim().toLowerCase();
    const aliases = Array.from(new Set([name, ...item.aliases.map(a => typeof a === 'string' ? a.trim().toLowerCase() : '')]));
    for (const alias of aliases) {
      if (!/^[a-z0-9_-]{1,32}$/.test(alias) || used.has(alias)) throw new Error('Bang names and aliases must be unique, using letters, numbers, _ or -.');
      used.add(alias);
    }
    if (item.url.length > 1000 || item.description.length > 120) throw new Error('URL or description is too long.');
    // The built-in redirect deliberately accepts the query itself as its destination.
    if (item.url !== '~QUERYHERE~') {
      let url: URL;
      try { url = new URL(item.url); } catch { throw new Error('Enter an absolute HTTP or HTTPS URL.'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP or HTTPS URL without credentials.');
    }
    return { name, aliases, url: item.url, description: item.description, favicon: suggestions.find(s => s.name === name)?.favicon || '' };
  });
}

export function getBangs(cookie = ''): CustomBang[] {
  try {
    const value = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(BANG_COOKIE + '='));
    if (value) return validateBangs(JSON.parse(decodeURIComponent(value.slice(BANG_COOKIE.length + 1))));
  } catch { /* Ignore invalid or obsolete session cookies. */ }
  return suggestions;
}

export function bangDestination(bang: CustomBang, query: string): string | undefined {
  try {
    const value = bang.url === '~QUERYHERE~' ? query : bang.url.split('~QUERYHERE~').join(encodeURIComponent(query));
    const url = new URL(value);
    if (['http:', 'https:'].includes(url.protocol)) return url.href;
  } catch { /* Invalid redirect input falls back to normal search. */ }
}
