/**
 * Suggestions / Bangs Configuration
 * 
 * Custom bang shortcuts for quick searches
 */

export interface Suggestion {
  name: string;
  aliases: string[];
  url: string;
  favicon: string;
  description: string;
}

const QUERY_PLACEHOLDER = "~QUERYHERE~";

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

/**
 * All available bang suggestions
 */
export const suggestions: Suggestion[] = [
  // General Search
  createSuggestion("g", ["google"], `https://www.google.com/search?q=${QUERY_PLACEHOLDER}`, "google.png", "Google Search"),
  createSuggestion("ddg", ["duckduckgo", "d"], `https://duckduckgo.com/?q=${QUERY_PLACEHOLDER}`, "duckduckgo.png", "DuckDuckGo"),
  createSuggestion("b", ["bing"], `https://www.bing.com/search?q=${QUERY_PLACEHOLDER}`, "bing.png", "Bing Search"),
  
  // Developer
  createSuggestion("gh", ["github"], `https://github.com/search?q=${QUERY_PLACEHOLDER}`, "github.png", "GitHub Search"),
  createSuggestion("npm", [], `https://www.npmjs.com/search?q=${QUERY_PLACEHOLDER}`, "npm.png", "NPM Packages"),
  createSuggestion("so", ["stackoverflow"], `https://stackoverflow.com/search?q=${QUERY_PLACEHOLDER}`, "stackoverflow.png", "Stack Overflow"),
  createSuggestion("mdn", [], `https://developer.mozilla.org/search?q=${QUERY_PLACEHOLDER}`, "mdn.png", "MDN Web Docs"),
  createSuggestion("crates", ["rs"], `https://crates.io/search?q=${QUERY_PLACEHOLDER}`, "rust.png", "Rust Crates"),
  createSuggestion("pypi", ["pip"], `https://pypi.org/search/?q=${QUERY_PLACEHOLDER}`, "python.png", "PyPI Packages"),
  createSuggestion("docker", ["hub"], `https://hub.docker.com/search?q=${QUERY_PLACEHOLDER}`, "docker.png", "Docker Hub"),
  
  // Media
  createSuggestion("yt", ["youtube"], `https://www.youtube.com/results?search_query=${QUERY_PLACEHOLDER}`, "youtube.png", "YouTube"),
  createSuggestion("sp", ["spotify"], `https://open.spotify.com/search/${QUERY_PLACEHOLDER}`, "spotify.png", "Spotify"),
  createSuggestion("twitch", ["tw"], `https://www.twitch.tv/search?term=${QUERY_PLACEHOLDER}`, "twitch.png", "Twitch"),
  
  // Shopping
  createSuggestion("a", ["amazon"], `https://www.amazon.com/s?k=${QUERY_PLACEHOLDER}`, "amazon-32.jpg", "Amazon"),
  createSuggestion("ebay", ["eb"], `https://www.ebay.com/sch/i.html?_nkw=${QUERY_PLACEHOLDER}`, "ebay.png", "eBay"),
  createSuggestion("orders", ["o"], `https://www.amazon.com/gp/your-account/order-history?search=${QUERY_PLACEHOLDER}`, "amazon-32.jpg", "Amazon Orders"),
  createSuggestion("ebo", ["ebayorders"], `https://www.ebay.com/mye/myebay/v2/purchase?q=${QUERY_PLACEHOLDER}`, "ebay.png", "eBay Orders"),
  
  // Reference
  createSuggestion("w", ["wiki", "wikipedia"], `https://en.wikipedia.org/wiki/Special:Search?search=${QUERY_PLACEHOLDER}`, "wikipedia.png", "Wikipedia"),
  createSuggestion("imdb", [], `https://www.imdb.com/find?q=${QUERY_PLACEHOLDER}`, "imdb.png", "IMDb"),
  createSuggestion("maps", ["gm"], `https://www.google.com/maps/search/${QUERY_PLACEHOLDER}`, "maps.png", "Google Maps"),
  
  // Social
  createSuggestion("r", ["reddit"], `https://www.reddit.com/search?q=${QUERY_PLACEHOLDER}`, "reddit.png", "Reddit"),
  createSuggestion("x", ["twitter"], `https://twitter.com/search?q=${QUERY_PLACEHOLDER}`, "twitter.png", "X/Twitter"),
  createSuggestion("li", ["linkedin"], `https://www.linkedin.com/search/results/all/?keywords=${QUERY_PLACEHOLDER}`, "linkedin.png", "LinkedIn"),
  
  // Utility
  createSuggestion("redirect", ["go"], `${QUERY_PLACEHOLDER}`, "redirect.png", "Redirect to URL"),
  createSuggestion("public", ["pub"], `https://github.com/section/${QUERY_PLACEHOLDER}`, "github.png", "Section GitHub"),
  
  // Crypto
  createSuggestion("cmc", ["coinmarketcap"], `https://coinmarketcap.com/currencies/${QUERY_PLACEHOLDER}`, "cmc.png", "CoinMarketCap"),
  createSuggestion("cg", ["coingecko"], `https://www.coingecko.com/en/coins/${QUERY_PLACEHOLDER}`, "coingecko.png", "CoinGecko"),
];

/**
 * Find a suggestion by bang slug
 */
export function findSuggestion(bang: string): Suggestion | undefined {
  const lowerBang = bang.toLowerCase();
  return suggestions.find(s => 
    s.name === lowerBang || s.aliases.includes(lowerBang)
  );
}

/**
 * Find suggestions that start with a prefix
 */
export function findSuggestionsStartingWith(prefix: string): Suggestion[] {
  const lowerPrefix = prefix.toLowerCase();
  return suggestions.filter(s =>
    s.name.startsWith(lowerPrefix) || 
    s.aliases.some(a => a.startsWith(lowerPrefix))
  );
}

export default suggestions;
