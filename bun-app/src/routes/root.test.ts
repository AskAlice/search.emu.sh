/**
 * Root Route Tests
 */

import { describe, expect, test } from "bun:test";
import { handleRoot, handleHealth, handleOsd } from "./root";

describe("Root Routes", () => {
  test("GET / returns { root: true }", async () => {
    const request = new Request("http://localhost/");
    const response = handleRoot(request);
    
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ root: true });
  });

  test("GET /health returns status ok", async () => {
    const request = new Request("http://localhost/health");
    const response = handleHealth(request);
    
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("pid");
    expect(body).toHaveProperty("bun");
  });

  test("GET /osd.xml returns OpenSearch XML", async () => {
    const request = new Request("http://localhost/osd.xml");
    const response = handleOsd(request);
    
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("xml");
    
    const body = await response.text();
    expect(body).toContain("OpenSearchDescription");
    expect(body).toContain("<ShortName>Search</ShortName>");
  });
});
