/**
 * Root Route Handlers
 */

/**
 * GET / - Root endpoint
 */
export function handleRoot(request: Request): Response {
  return Response.json({ root: true });
}

/**
 * GET /health - Health check
 */
export function handleHealth(request: Request): Response {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    pid: process.pid,
    workerId: process.env.WORKER_ID || "main",
    bun: Bun.version,
  });
}

/**
 * GET /osd.xml - OpenSearch description
 */
export function handleOsd(request: Request): Response {
  const url = new URL(request.url);
  const hostname = url.hostname || "localhost";
  const userAgent = request.headers.get("user-agent") || "";
  const client = /Firefox/i.test(userAgent) ? "firefox" : "chrome";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/"
    xmlns:moz="http://www.mozilla.org/2006/browser/search/">
  <OutputEncoding>UTF-8</OutputEncoding>
  <ShortName>Search</ShortName>
  <Description>Custom search with bang support</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image height="16" width="16">https://${hostname}/favicon.ico</Image>
  <Url type="text/html" method="GET"
      template="https://${hostname}/search?client=${client}&amp;q={searchTerms}" />
  <Url type="application/x-suggestions+json" method="GET"
      template="https://${hostname}/suggest?client=${client}&amp;q={searchTerms}" />
</OpenSearchDescription>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/opensearchdescription+xml; charset=utf-8" },
  });
}
