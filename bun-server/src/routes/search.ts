/**
 * Search Route Handler
 * 
 * Handles bang searches and redirects to appropriate search engines.
 */

import type { RequestContext } from "../router";
import { suggestions } from "../utils/suggestions";
import { redirectBody } from "../utils/redirect";

/**
 * Handle search path
 */
export async function handleSearch(ctx: RequestContext): Promise<Response> {
  const q = ctx.query.q;
  const useApiKeys = ctx.query.useApiKeys === "true";
  
  // If no query, redirect to home
  if (!q) {
    return new Response(null, {
      status: 302,
      headers: { "Location": "/" },
    });
  }
  
  // Parse the query for bang syntax
  const searchRegex = q.match(/(?<hasBang>\!?)(?<bang>(?<=\!)[\w\d-_]+)?([\s\+]+)?(?<search>.*)?/);
  
  if (!searchRegex?.groups) {
    return redirectTo("https://google.com/search?q=" + encodeURIComponent(q));
  }
  
  const { hasBang, bang, search = "" } = searchRegex.groups;
  const bangSlug = bang?.toLowerCase() || "";
  const hasExclamation = hasBang === "!";
  
  // Check custom suggestions/bangs
  for (const s of suggestions) {
    if (s.aliases.includes(bangSlug) || s.name === bangSlug) {
      const url = s.url.replace("~QUERYHERE~", search);
      return sendRedirect(url);
    }
  }
  
  // If has bang but not found in custom list, use DuckDuckGo
  if (hasExclamation) {
    return redirectTo("https://duckduckgo.com/?q=" + encodeURIComponent(q));
  }
  
  // Default to Google search
  return redirectTo("https://google.com/search?q=" + encodeURIComponent(q));
}

/**
 * Send HTML redirect response
 */
function sendRedirect(url: string): Response {
  return new Response(redirectBody(url), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Referrer-Policy": "origin",
    },
  });
}

/**
 * Send 302 redirect
 */
function redirectTo(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { "Location": url },
  });
}
