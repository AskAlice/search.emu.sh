/**
 * Suggest Route Handler
 * 
 * Provides search suggestions for browser omnibox integration.
 * Returns results in Chrome/Firefox compatible format.
 * 
 * Features:
 * - Custom bang suggestions
 * - Google suggestions proxy
 * - Crypto price lookups (with API key)
 */

import { suggestions, findSuggestionsStartingWith } from "../utils/suggestions";

// Query placeholder
const QUERY_PLACEHOLDER = "~QUERYHERE~";

// Bang regex
const BANG_REGEX = /^!(?<bang>[\w\d-]*)(?:\s+(?<query>.*))?$/;

// Crypto assets for price lookups
const CRYPTO_ASSETS = [
  { symbol: "BTC", name: "Bitcoin", image: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png" },
  { symbol: "ETH", name: "Ethereum", image: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
  { symbol: "SOL", name: "Solana", image: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
  { symbol: "DOGE", name: "Dogecoin", image: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png" },
  { symbol: "XRP", name: "Ripple", image: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png" },
  { symbol: "ADA", name: "Cardano", image: "https://assets.coingecko.com/coins/images/975/small/cardano.png" },
  { symbol: "AVAX", name: "Avalanche", image: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png" },
  { symbol: "DOT", name: "Polkadot", image: "https://assets.coingecko.com/coins/images/12171/small/polkadot.png" },
  { symbol: "MATIC", name: "Polygon", image: "https://assets.coingecko.com/coins/images/4713/small/polygon.png" },
  { symbol: "LINK", name: "Chainlink", image: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png" },
];

// Simple cache for crypto prices
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface SuggestResult {
  suggestion: string;
  type: string;
  subtypes: (string | number)[];
  detail: {
    a?: string;  // annotation
    dc?: string; // dominant color
    i?: string;  // image URL
    q?: string;  // query parameters
    t?: string;  // title
  };
  relevance: number;
}

/**
 * Handle GET /suggest
 */
export async function handleSuggest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const client = (url.searchParams.get("client") || "chrome-omni").toLowerCase();
  const useApiKeys = url.searchParams.get("useApiKeys") === "true";
  const formatJson = url.searchParams.get("format") === "json" || url.searchParams.get("type") === "json";

  const results: SuggestResult[] = [];

  // Check for bang pattern
  const bangMatch = q.match(BANG_REGEX);
  
  if (bangMatch?.groups) {
    const { bang = "", query = "" } = bangMatch.groups;
    
    // Find matching bangs
    const matchingSuggestions = findSuggestionsStartingWith(bang);
    
    for (const s of matchingSuggestions.slice(0, 5)) {
      const targetUrl = s.url.replace(QUERY_PLACEHOLDER, query.trim());
      results.push({
        suggestion: `!${s.name}${query ? ` ${query}` : ""}`,
        type: "ENTITY",
        subtypes: ["Bang", s.description],
        detail: {
          a: targetUrl,
          dc: "#4361ee",
          i: `/icons/${s.favicon}`,
          t: `!${s.name} - ${s.description}`,
        },
        relevance: 1000 - results.length,
      });
    }
  }

  // Check for crypto price lookup
  const cryptoMatch = q.trim().match(/^(?<amount>\d+(?:\.\d+)?)\s*(?<symbol>\w+)$/i);
  if (cryptoMatch?.groups && useApiKeys) {
    const { amount, symbol } = cryptoMatch.groups;
    const asset = CRYPTO_ASSETS.find(a => 
      a.symbol.toLowerCase() === symbol.toLowerCase() ||
      a.name.toLowerCase() === symbol.toLowerCase()
    );
    
    if (asset) {
      const price = await getCryptoPrice(asset.symbol);
      if (price !== null) {
        const total = parseFloat(amount) * price;
        const formatted = total.toLocaleString("en-US", { 
          style: "currency", 
          currency: "USD",
          minimumFractionDigits: 2,
          maximumFractionDigits: total < 1 ? 6 : 2,
        });
        
        results.push({
          suggestion: `!cmc ${asset.name.toLowerCase()}`,
          type: "ENTITY",
          subtypes: ["Crypto", "Price"],
          detail: {
            a: asset.name,
            dc: "#f7931a",
            i: asset.image,
            t: `${amount} ${asset.symbol} = ${formatted}`,
          },
          relevance: 2000,
        });
      }
    }
  }

  // Fetch Google suggestions if we need more results
  if (results.length < 8 && q.length > 0 && !q.startsWith("!")) {
    try {
      const googleResults = await fetchGoogleSuggestions(q, client);
      
      for (const suggestion of googleResults.slice(0, 8 - results.length)) {
        results.push({
          suggestion,
          type: "QUERY",
          subtypes: [],
          detail: {},
          relevance: 500 - results.length,
        });
      }
    } catch (error) {
      console.error("Google suggestions error:", error);
    }
  }

  // Sort by relevance
  results.sort((a, b) => b.relevance - a.relevance);

  // Return JSON format if requested
  if (formatJson) {
    return Response.json(results);
  }

  // Build Chrome/Firefox omnibox format
  return formatOmniboxResponse(q, results, client);
}

/**
 * Fetch suggestions from Google
 */
async function fetchGoogleSuggestions(query: string, client: string): Promise<string[]> {
  const params = new URLSearchParams({
    q: query,
    client: client === "firefox" ? "firefox" : "chrome-omni",
    hl: "en",
  });

  const response = await fetch(`https://www.google.com/complete/search?${params}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      "Accept": "*/*",
    },
  });

  if (!response.ok) {
    return [];
  }

  let text = await response.text();
  
  // Remove JSONP wrapper
  if (text.startsWith(")]}'\n")) {
    text = text.substring(5);
  } else if (text.includes("(")) {
    const match = text.match(/\((.+)\)/s);
    if (match) text = match[1];
  }

  try {
    const data = JSON.parse(text);
    return Array.isArray(data[1]) ? data[1] : [];
  } catch {
    return [];
  }
}

/**
 * Get crypto price (with caching)
 */
async function getCryptoPrice(symbol: string): Promise<number | null> {
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }

  const apiKey = process.env.CRYPTOCOMPARE_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=USD&api_key=${apiKey}`
    );
    const data = await response.json() as { USD?: number };
    
    if (data.USD) {
      priceCache.set(symbol, { price: data.USD, timestamp: Date.now() });
      return data.USD;
    }
  } catch (error) {
    console.error("Crypto price error:", error);
  }
  
  return null;
}

/**
 * Format response for Chrome/Firefox omnibox
 */
function formatOmniboxResponse(query: string, results: SuggestResult[], client: string): Response {
  const isFirefox = client === "firefox";
  
  // Key names differ between Chrome and Firefox
  const keys = {
    suggestType: isFirefox ? "suggestType" : "google:suggesttype",
    suggestSubtypes: isFirefox ? "suggestSubtypes" : "google:suggestsubtypes",
    suggestDetail: isFirefox ? "suggestDetail" : "google:suggestdetail",
    suggestRelevance: isFirefox ? "suggestRelevance" : "google:suggestrelevance",
    verbatimRelevance: isFirefox ? "verbatimrelevance" : "google:verbatimrelevance",
  };

  const metadata: Record<string, unknown[]> = {
    [keys.suggestType]: [],
    [keys.suggestSubtypes]: [],
    [keys.suggestDetail]: [],
    [keys.suggestRelevance]: [],
  };

  const suggestions: string[] = [];
  const descriptions: string[] = [];

  for (const r of results) {
    suggestions.push(r.suggestion);
    descriptions.push(r.detail.t || "");
    metadata[keys.suggestType].push(r.type);
    metadata[keys.suggestSubtypes].push(r.subtypes);
    metadata[keys.suggestDetail].push(r.detail);
    metadata[keys.suggestRelevance].push(r.relevance);
  }

  (metadata as Record<string, unknown>)[keys.verbatimRelevance] = results[0]?.relevance || 100;

  // Build response array
  const response: unknown[] = [query, suggestions, descriptions];
  
  if (isFirefox) {
    response.push(metadata);
  } else {
    response.push([], metadata);
  }

  // Chrome expects a prefix
  const prefix = isFirefox ? "" : ")]}'\n";
  const body = prefix + JSON.stringify(response);

  return new Response(body, {
    headers: {
      "Content-Type": "text/javascript; charset=UTF-8",
    },
  });
}
