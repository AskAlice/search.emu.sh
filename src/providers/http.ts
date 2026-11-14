import axios, { AxiosRequestConfig } from 'axios';
import NodeCache from 'node-cache';

// Omnibox fires a request per keystroke, so backspacing or retyping repeats identical upstream calls.
// ponytail: per-instance memory cache; move to a shared store (Redis/Vercel KV) if hit rate across instances matters.
// Per-call cap for suggestion-list upstreams. /suggest's handler deadline (700ms) stays strictly greater,
// so a stalled upstream lets the reply go out at ~600ms instead of waiting for the deadline.
export const UPSTREAM_TIMEOUT_MS = 600;

export const httpCache = new NodeCache({ checkperiod: 60, useClones: false, maxKeys: 5000 });

/** GET `url` and cache successful response data for `ttl` seconds. Failures are never cached. */
export async function cachedGet<T = any>(url: string, ttl: number, config: AxiosRequestConfig = {}): Promise<T> {
  const hit = httpCache.get<T>(url);
  if (hit !== undefined) return hit;
  const { data } = await axios.get<T>(url, config);
  try { httpCache.set(url, data, ttl); } catch { /* Cache full: serve uncached until entries expire. */ }
  return data;
}
