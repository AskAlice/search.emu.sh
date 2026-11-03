/**
 * Search Route Tests
 */

import { describe, expect, test } from "bun:test";
import { handleSearch } from "./search";

describe("Search Route", () => {
  test("empty query redirects to home", async () => {
    const request = new Request("http://localhost/search");
    const response = await handleSearch(request);
    
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");
  });

  test("plain query redirects to Google", async () => {
    const request = new Request("http://localhost/search?q=hello+world");
    const response = await handleSearch(request);
    
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("google.com/search");
    expect(body).toContain("hello");
  });

  test("!gh bang redirects to GitHub", async () => {
    const request = new Request("http://localhost/search?q=!gh+bun");
    const response = await handleSearch(request);
    
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("github.com/search");
    expect(body).toContain("bun");
  });

  test("!yt bang redirects to YouTube", async () => {
    const request = new Request("http://localhost/search?q=!yt+funny+cats");
    const response = await handleSearch(request);
    
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("youtube.com");
  });

  test("unknown bang falls back to DuckDuckGo", async () => {
    const request = new Request("http://localhost/search?q=!unknown+query");
    const response = await handleSearch(request);
    
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("duckduckgo.com");
  });
});
