/**
 * Search Route Handler
 * 
 * Handles bang searches and redirects to appropriate search engines.
 * 
 * Examples:
 *   /search?q=hello           → Google search
 *   /search?q=!gh bun         → GitHub search for "bun"
 *   /search?q=!yt funny cats  → YouTube search
 *   /search?q=!redirect https://example.com → Direct redirect
 */

import { findSuggestion, suggestions } from "../utils/suggestions";

// Query placeholder used in suggestion URLs
const QUERY_PLACEHOLDER = "~QUERYHERE~";

// Bang regex pattern
const BANG_REGEX = /^!(?<bang>[\w\d-]+)(?:\s+(?<query>.*))?$/;

/**
 * Handle GET /search
 */
export async function handleSearch(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || "";

  // No query - redirect to home
  if (!q) {
    return Response.redirect("/", 302);
  }

  // Check for bang syntax: !bang query
  const bangMatch = q.match(BANG_REGEX);
  
  if (bangMatch?.groups) {
    const { bang, query = "" } = bangMatch.groups;
    const suggestion = findSuggestion(bang);
    
    if (suggestion) {
      const targetUrl = suggestion.url.replace(QUERY_PLACEHOLDER, encodeURIComponent(query.trim()));
      return createRedirect(targetUrl);
    }
    
    // Unknown bang - try DuckDuckGo (they support many bangs)
    return createRedirect(`https://duckduckgo.com/?q=${encodeURIComponent(q)}`);
  }

  // Check if query starts with ! but didn't match pattern (send to DuckDuckGo)
  if (q.startsWith("!")) {
    return createRedirect(`https://duckduckgo.com/?q=${encodeURIComponent(q)}`);
  }

  // Default: Google search
  return createRedirect(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
}

/**
 * Create an HTML redirect response
 * Uses meta refresh + JavaScript for maximum compatibility
 */
function createRedirect(targetUrl: string): Response {
  // Validate URL
  let validUrl: string;
  try {
    validUrl = new URL(targetUrl).href;
  } catch {
    // If it's not a valid URL, try prefixing with https://
    try {
      validUrl = new URL("https://" + targetUrl).href;
    } catch {
      validUrl = targetUrl;
    }
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex,nofollow">
<meta http-equiv="refresh" content="0;url=${escapeHtml(validUrl)}">
<title>Redirecting...</title>
<style>
body{background:#1a1a2e;color:#eee;font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}
a{color:#4cc9f0}
</style>
</head>
<body>
<p>Redirecting to <a href="${escapeHtml(validUrl)}">${escapeHtml(validUrl)}</a>...</p>
<script>location.replace("${escapeJs(validUrl)}")</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Redirect-Target": validUrl,
    },
  });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape string for JavaScript
 */
function escapeJs(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}
