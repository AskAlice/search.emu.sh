/**
 * Example Route Tests
 */

import { describe, expect, test } from "bun:test";
import { handleExample } from "./example";
import type { RequestContext } from "../router";

function createMockContext(): RequestContext {
  const url = new URL("http://localhost:3006/example");
  return {
    request: new Request(url),
    url,
    path: "/example",
    method: "GET",
    query: {},
    params: {},
  };
}

describe("Example Route", () => {
  test("returns example text", async () => {
    const ctx = createMockContext();
    const response = handleExample(ctx);
    
    expect(response.status).toBe(200);
    
    const body = await response.text();
    expect(body).toBe("this is an example");
  });
});
