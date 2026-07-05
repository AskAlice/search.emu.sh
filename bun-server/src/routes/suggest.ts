/**
 * Suggest Route Handler
 * 
 * Provides search suggestions with custom bangs, crypto prices, DNS lookups, etc.
 */

import type { RequestContext } from "../router";
import { suggestions } from "../utils/suggestions";
import { cryptoAssets } from "../utils/crypto-assets";
import { SimpleCache } from "../utils/cache";
import { config } from "../config";

// Cache for crypto prices
const priceCache = new SimpleCache<number>(config.cache.ttl);

// Types
interface SuggestResult {
  suggestion: string;
  type: string;
  subtypes: (string | number)[];
  detail: {
    a?: string;
    dc?: string;
    i?: string;
    q?: string;
    t?: string;
    zae?: string;
  };
  relevance: number;
}

/**
 * Handle suggest path
 */
export async function handleSuggest(ctx: RequestContext): Promise<Response> {
  const q = ctx.query.q || "";
  const client = (ctx.query.client || "chrome-omni").toLowerCase();
  const type = ctx.query.type;
  const format = ctx.query.format;
  const useApiKeys = ctx.query.useApiKeys === "true";
  
  // Determine key names based on client type
  const isJsonFormat = type === "json";
  const suggestType = isJsonFormat ? "suggestType" : "google:suggesttype";
  const suggestSubtypes = isJsonFormat ? "suggestSubtypes" : "google:suggestsubtypes";
  const suggestDetail = isJsonFormat ? "suggestDetail" : "google:suggestdetail";
  const suggestRelevance = isJsonFormat ? "suggestRelevance" : "google:suggestrelevance";
  const verbatimrelevance = isJsonFormat ? "verbatimrelevance" : "google:verbatimrelevance";
  
  // Parse query for bang syntax
  const searchRegex = q.match(/(?<hasBang>\!?)(?<bang>(?<=\!)[\w\d-_]+)?([\s\+]+)?(?<search>.*)?/);
  const { search = "", bang: bangSlug = "" } = searchRegex?.groups ?? {};
  const searchingBang = typeof bangSlug === "string" && bangSlug.length > 0;
  
  const results: SuggestResult[] = [];
  
  // Helper to add results
  const addResult = (
    suggestion: string,
    type: string,
    subtypes: (string | number)[],
    detail: SuggestResult["detail"],
    relevance: number
  ) => {
    results.push({ suggestion, type, subtypes, detail, relevance });
  };
  
  // Check custom suggestions/bangs
  for (const s of suggestions) {
    if (s.aliases.some((a: string) => a.startsWith(bangSlug)) && bangSlug.length > 0) {
      addResult(
        `!${s.name}${search ? ` ${search}` : ""}`,
        "ENTITY",
        ["Custom Bang", "BANG", s.url.replace("~QUERYHERE~", search)],
        {
          a: s.url.replace("~QUERYHERE~", search),
          dc: "#DE5833",
          i: `https://search.emu.sh/icons/${s.favicon}`,
          q: " ",
          t: `!${s.name} - ${s.description}: ${search}`,
        },
        444
      );
    }
  }
  
  // Check crypto assets
  const cryptoMatch = q.trim().match(/(?<coef>\d+(?:\.\d+)?)?\s?(?<symbol>.*)?/);
  if (cryptoMatch?.groups?.symbol && cryptoMatch.groups.symbol.length > 2) {
    const symbolQuery = cryptoMatch.groups.symbol.toLowerCase();
    const matchedAssets = cryptoAssets.filter(
      (a) =>
        a.assetSymbol.toLowerCase() === symbolQuery ||
        a.assetSymbol.toLowerCase().startsWith(symbolQuery) ||
        a.assetName.toLowerCase() === symbolQuery
    );
    
    if (matchedAssets.length > 0 && useApiKeys && config.cryptocompareKey) {
      const asset = matchedAssets[0];
      const coef = parseFloat(cryptoMatch.groups.coef || "1");
      
      // Check cache first
      let price = priceCache.get(asset.assetSymbol);
      
      if (price === undefined) {
        try {
          const response = await fetch(
            `https://min-api.cryptocompare.com/data/price?fsym=${asset.assetSymbol}&tsyms=USD&api_key=${config.cryptocompareKey}`
          );
          const data = await response.json() as { USD?: number };
          price = data.USD || 0;
          priceCache.set(asset.assetSymbol, price);
        } catch (error) {
          console.error("Crypto price fetch error:", error);
          price = 0;
        }
      }
      
      if (price > 0) {
        const total = coef * price;
        const formattedPrice = total > 0.99
          ? total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
          : total.toString();
        
        addResult(
          `!cmc ${asset.assetName.toLowerCase().replace(" ", "-")}`,
          "ENTITY",
          ["crypto"],
          {
            a: `${asset.assetName} - ${asset.description}`,
            dc: "#DE5833",
            i: asset.image,
            q: "",
            t: `${coef} ${asset.assetSymbol} = $${formattedPrice} USD`,
          },
          1999
        );
      }
    }
  }
  
  // Fetch Google suggestions if we need more results
  if (results.length < 4) {
    try {
      const googleQuery = searchingBang
        ? { ...ctx.query, q: search }
        : ctx.query;
      
      const params = new URLSearchParams(googleQuery);
      const googleUrl = `https://www.google.com/complete/search?${params}`;
      
      const response = await fetch(googleUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      
      if (response.ok) {
        let data = await response.text();
        
        // Remove JSONP wrapper if present
        if (client !== "firefox" && data.startsWith(")]}'\n")) {
          data = data.substring(5);
        } else if (data.includes("(")) {
          const match = data.match(/\((.+)\)/s);
          if (match) {
            data = match[1];
          }
        }
        
        try {
          const parsed = JSON.parse(data);
          const suggestions = parsed[1] || [];
          const metadata = parsed[client !== "firefox" ? 4 : 3] || {};
          
          suggestions.forEach((suggestion: string, i: number) => {
            const suggestionText = searchingBang
              ? suggestion.replace(new RegExp(`(^)(${bangSlug}\\s)?`, "g"), `!${bangSlug} $1`)
              : suggestion;
            
            addResult(
              suggestionText,
              metadata["google:suggesttype"]?.[i] || "QUERY",
              metadata["google:suggestsubtypes"]?.[i] || [],
              metadata["google:suggestdetail"]?.[i] || {},
              metadata["google:suggestrelevance"]?.[i] || 500 - i
            );
          });
        } catch (parseError) {
          console.error("Failed to parse Google response:", parseError);
        }
      }
    } catch (error) {
      console.error("Google suggestions fetch error:", error);
    }
  }
  
  // Sort results by relevance
  results.sort((a, b) => b.relevance - a.relevance);
  
  // Return JSON format if requested
  if (format === "json" || type === "json") {
    return Response.json(results);
  }
  
  // Build Chrome/Firefox suggestions format
  const searchFormat: [string, string[], string[], Record<string, unknown>] = [q, [], [], {}];
  
  const googleRes: Record<string, unknown[]> = {
    [suggestType]: [],
    [suggestSubtypes]: [],
    [suggestDetail]: [],
    [suggestRelevance]: [],
  };
  
  for (const res of results) {
    searchFormat[1].push(res.suggestion);
    searchFormat[2].push("");
    googleRes[suggestType].push(res.type);
    googleRes[suggestSubtypes].push(res.subtypes);
    googleRes[suggestDetail].push(res.detail);
    googleRes[suggestRelevance].push(res.relevance);
  }
  
  (googleRes as Record<string, unknown>)[verbatimrelevance] = results[0]?.relevance || 555;
  
  if (client !== "firefox") {
    (searchFormat as unknown[]).push(googleRes);
  } else {
    searchFormat[3] = googleRes as Record<string, unknown>;
  }
  
  // Add prefix for Chrome
  const header = client === "firefox" ? "" : ")]}'\n";
  
  return new Response(`${header}${JSON.stringify(searchFormat)}`, {
    status: 200,
    headers: {
      "Content-Type": "text/javascript; charset=UTF-8",
      "Content-Disposition": "attachment; filename=suggestions.txt",
    },
  });
}
