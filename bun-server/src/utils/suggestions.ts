/**
 * Custom Search Suggestions/Bangs
 */

interface Suggestion {
  name: string;
  aliases: string[];
  url: string;
  favicon: string;
  description: string;
}

function createSuggestion(
  name: string,
  aliases: string[],
  url: string,
  favicon: string,
  description: string
): Suggestion {
  return {
    name,
    aliases: [name, ...aliases],
    url,
    favicon,
    description,
  };
}

const search = "~QUERYHERE~";

export const suggestions: Suggestion[] = [
  createSuggestion(
    "public",
    ["pub"],
    `https://github.com/section/${search}`,
    "github.png",
    "Section Github Org Search"
  ),
  createSuggestion(
    "redirect",
    [],
    `${search}`,
    "redirect.png",
    "redirect to url"
  ),
  createSuggestion(
    "ebo",
    ["ebayorders"],
    `https://www.ebay.com/mye/myebay/v2/purchase?page=1&q=${search}&mp=purchase-search-module-v2&type=v2&pg=purchase`,
    "ebay.png",
    "ebay orders"
  ),
  createSuggestion(
    "orders",
    ["o"],
    `https://smile.amazon.com/gp/your-account/order-history/ref=ppx_yo_dt_b_search?opt=ab&search=${search}`,
    "amazon-32.jpg",
    "Amazon Orders"
  ),
  createSuggestion(
    "g",
    ["google"],
    `https://www.google.com/search?q=${search}`,
    "google.png",
    "Google Search"
  ),
  createSuggestion(
    "ddg",
    ["duckduckgo"],
    `https://duckduckgo.com/?q=${search}`,
    "duckduckgo.png",
    "DuckDuckGo Search"
  ),
  createSuggestion(
    "gh",
    ["github"],
    `https://github.com/search?q=${search}`,
    "github.png",
    "GitHub Search"
  ),
  createSuggestion(
    "npm",
    [],
    `https://www.npmjs.com/search?q=${search}`,
    "npm.png",
    "NPM Package Search"
  ),
  createSuggestion(
    "yt",
    ["youtube"],
    `https://www.youtube.com/results?search_query=${search}`,
    "youtube.png",
    "YouTube Search"
  ),
  createSuggestion(
    "so",
    ["stackoverflow"],
    `https://stackoverflow.com/search?q=${search}`,
    "stackoverflow.png",
    "Stack Overflow Search"
  ),
  createSuggestion(
    "mdn",
    [],
    `https://developer.mozilla.org/en-US/search?q=${search}`,
    "mdn.png",
    "MDN Web Docs Search"
  ),
  createSuggestion(
    "w",
    ["wiki", "wikipedia"],
    `https://en.wikipedia.org/wiki/Special:Search?search=${search}`,
    "wikipedia.png",
    "Wikipedia Search"
  ),
];

export default suggestions;
