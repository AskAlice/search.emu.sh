/**
 * Router Tests
 */

import { describe, expect, test } from "bun:test";
import { router } from "./router";

describe("Router", () => {
  test("handles root path", async () => {
    const request = new Request("http://localhost:3006/");
    const response = await router(request);
    
    expect(response.status).toBe(200);
    
    const body = await response.json();
    expect(body).toEqual({ root: true });
  });
  
  test("handles /example path", async () => {
    const request = new Request("http://localhost:3006/example");
    const response = await router(request);
    
    expect(response.status).toBe(200);
    
    const body = await response.text();
    expect(body).toBe("this is an example");
  });
  
  test("handles /health path", async () => {
    const request = new Request("http://localhost:3006/health");
    const response = await router(request);
    
    expect(response.status).toBe(200);
    
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("pid");
  });
  
  test("returns 404 for unknown paths", async () => {
    const request = new Request("http://localhost:3006/unknown-path");
    const response = await router(request);
    
    expect(response.status).toBe(404);
    
    const body = await response.json();
    expect(body.error).toBe("Not Found");
  });
  
  test("handles OPTIONS for CORS", async () => {
    const request = new Request("http://localhost:3006/", {
      method: "OPTIONS",
    });
    const response = await router(request);
    
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
  
  test("handles /search with no query redirects to home", async () => {
    const request = new Request("http://localhost:3006/search");
    const response = await router(request);
    
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");
  });
  
  test("handles /osd.xml", async () => {
    const request = new Request("http://localhost:3006/osd.xml");
    const response = await router(request);
    
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("xml");
  });
});
