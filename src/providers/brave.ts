import { cachedGet, UPSTREAM_TIMEOUT_MS } from './http';
import type { RichSuggestion } from '../rich';

export async function braveSuggestions(query: string, bangSlug?: string, signal?: AbortSignal, options: Record<string, unknown> = {}): Promise<RichSuggestion[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key || !query.trim() || query.length > 400 || query.trim().split(/\s+/).length > 50) return [];
  try {
    const params = new URLSearchParams();
    params.set('q', query); params.set('rich', 'true'); params.set('count', '8');
    if (typeof options.gl === 'string' && /^[a-z]{2}$/i.test(options.gl)) params.set('country', options.gl.toUpperCase());
    if (typeof options.hl === 'string' && /^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(options.hl)) params.set('lang', options.hl.toLowerCase());
    const data = await cachedGet('https://api.search.brave.com/res/v1/suggest/search?' + params, 300, { headers: { Accept: 'application/json', 'X-Subscription-Token': key }, timeout: UPSTREAM_TIMEOUT_MS, signal });
    if (!Array.isArray(data?.results)) return [];
    return data.results.filter(item => typeof item?.query === 'string' && item.query.trim()).slice(0, 8).map((item, index) => {
      let image: string | undefined;
      try { if (typeof item.img === 'string' && new URL(item.img).protocol === 'https:') image = item.img; } catch { /* Ignore malformed images. */ }
      return {
        suggestion: bangSlug ? `!${bangSlug} ${item.query}` : item.query,
        title: typeof item.title === 'string' && item.title ? item.title : bangSlug ? `!${bangSlug} ${item.query}` : item.query,
        annotation: typeof item.description === 'string' ? item.description : '',
        image, type: item.is_entity ? 'ENTITY' : 'QUERY',
        relevance: (item.is_entity ? 7400 : 1250) - index, source: 'brave' as const,
      };
    });
  } catch { return []; }
}
