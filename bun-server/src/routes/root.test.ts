/**
 * Root Route Tests
 */

import { describe, expect, test } from "bun:test";
import { handleRoot, handleOsd } from "./root";
import type { RequestContext } from "../router";

// Helper to create mock context
function createMockContext(overrides: Partial<RequestContext> = {}): RequestContext {
  const url = new URL("http://localhost:3006/");
  return {
    request: new Request(url),
    url,
    path: "/",
    method: "GET",
    query: {},
    params: {},
    ...overrides,
  };
}

describe("Root Route", () => {
  test("handleRoot returns { root: true }", async () => {
    const ctx = createMockContext();
    const response = handleRoot(ctx);
    
    expect(response.status).toBe(200);
    
    const body = await response.json();
    expect(body).toEqual({ root: true });
  });
  
  test("handleOsd returns XML content", async () => {
    const ctx = createMockContext({
      path: "/osd.xml",
    });
    const response = handleOsd(ctx);
    
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/opensearchdescription+xml");
    
    const body = await response.text();
    expect(body).toContain("OpenSearchDescription");
    expect(body).toContain("<ShortName>search</ShortName>");
  });
});
