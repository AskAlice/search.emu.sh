/**
 * Test Route Handler - DNS Query Testing
 */

import type { RequestContext } from "../router";

/**
 * Perform DNS over HTTPS query
 */
async function dohQuery(domain: string, type: string): Promise<any> {
  const url = `https://1.1.1.1/dns-query?name=${encodeURIComponent(domain)}&type=${type}`;
  
  const response = await fetch(url, {
    headers: {
      "Accept": "application/dns-json",
    },
  });
  
  if (!response.ok) {
    throw new Error(`DNS query failed: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Handle test path - DNS query demonstration
 */
export async function handleTest(ctx: RequestContext): Promise<Response> {
  try {
    const response = await dohQuery("section.io", "NS");
    
    let result = "";
    if (response.Answer) {
      for (const ans of response.Answer) {
        result += `${ans.name} ${ans.TTL} IN ${ans.type === 2 ? "NS" : ans.type} ${ans.data}\n`;
      }
    }
    
    return new Response(result || "No DNS records found", {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("DNS query error:", error);
    return new Response(`DNS query error: ${error instanceof Error ? error.message : "Unknown error"}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
