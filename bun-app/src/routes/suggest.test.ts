/**
 * Suggest Route Tests
 */

import { describe, expect, test } from "bun:test";
import { handleSuggest } from "./suggest";

describe("Suggest Route", () => {
  test("returns JSON format when requested", async () => {
    const request = new Request("http://localhost/suggest?q=!gh&format=json");
    const response = await handleSuggest(request);
    
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty("suggestion");
  });

  test("returns bang suggestions for !gh", async () => {
    const request = new Request("http://localhost/suggest?q=!gh&format=json");
    const response = await handleSuggest(request);
    
    const body = await response.json();
    const ghSuggestion = body.find((s: any) => s.suggestion.startsWith("!gh"));
    expect(ghSuggestion).toBeDefined();
    expect(ghSuggestion.type).toBe("ENTITY");
  });

  test("returns Chrome omnibox format by default", async () => {
    const request = new Request("http://localhost/suggest?q=test&client=chrome-omni");
    const response = await handleSuggest(request);
    
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("javascript");
    
    const body = await response.text();
    expect(body.startsWith(")]}'\n")).toBe(true);
  });

  test("returns Firefox format for firefox client", async () => {
    const request = new Request("http://localhost/suggest?q=test&client=firefox");
    const response = await handleSuggest(request);
    
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body.startsWith(")]}'\n")).toBe(false);
    expect(body.startsWith("[")).toBe(true);
  });

  test("finds multiple matching bangs", async () => {
    const request = new Request("http://localhost/suggest?q=!g&format=json");
    const response = await handleSuggest(request);
    
    const body = await response.json();
    // Should find !g, !gh, !go (redirect)
    expect(body.length).toBeGreaterThanOrEqual(1);
  });
});
