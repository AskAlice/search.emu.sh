/**
 * Root Route Handlers
 */

import type { RequestContext } from "../router";

/**
 * Handle root path
 */
export function handleRoot(ctx: RequestContext): Response {
  return Response.json({ root: true });
}

/**
 * Handle OpenSearch description XML
 */
export function handleOsd(ctx: RequestContext): Response {
  const hostname = ctx.url.hostname || "localhost";
  const userAgent = ctx.request.headers.get("user-agent") || "";
  const isFirefox = /Firefox/i.test(userAgent);
  const client = isFirefox ? "firefox" : "chrome";
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/"
    xmlns:moz="http://www.mozilla.org/2006/browser/search/">
  <OutputEncoding>UTF-8</OutputEncoding>
  <Image height="16" width="16" type="image/x-icon">https://${hostname}/favicon.ico</Image>
  <Image height="16" width="16" type="image/vnd.microsoft.icon">https://${hostname}/favicon.ico</Image>
  <Image height="512" width="512" type="image/png">https://${hostname}/logo512.png</Image>
  <ShortName>search</ShortName>
  <Description>[Search engine full name and summary]</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image height="16" width="16">https://${hostname}/favicon.ico</Image>
  <Url type="text/html"
      method="GET"
      template="https://${hostname}/search?client=${client}&amp;useApiKeys=true&amp;q=%s" 
  />
  <Url type="application/x-suggestions+json" method="GET" template="https://${hostname}/suggest?client=${client}&amp;useApiKeys=true&amp;q={searchTerms}" />
</OpenSearchDescription>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/opensearchdescription+xml; charset=utf-8",
    },
  });
}
