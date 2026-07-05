/**
 * Example Route Handler
 */

import type { RequestContext } from "../router";

/**
 * Handle example path
 */
export function handleExample(ctx: RequestContext): Response {
  return new Response("this is an example", {
    headers: { "Content-Type": "text/plain" },
  });
}
