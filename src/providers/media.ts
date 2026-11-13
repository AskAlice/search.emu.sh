import { cachedGet } from './http';
import type { RichSuggestion } from '../rich';

export async function mediaSuggestions(kind: 'movie' | 'tv', query: string, signal?: AbortSignal): Promise<RichSuggestion[]> {
  const token = process.env.TMDB_ACCESS_TOKEN;
  const key = process.env.TMDB_API_KEY;
  if (!token && !key) return [];
  try {
    const url = new URL(kind === 'tv' ? 'https://api.themoviedb.org/3/search/tv' : 'https://api.themoviedb.org/3/search/movie');
    url.searchParams.set('query', query);
    if (!token) url.searchParams.set('api_key', key!);
    const data = await cachedGet(url.href, 3600, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      timeout: 750, signal,
    });
    if (!Array.isArray(data?.results)) return [];
    return data.results.filter(item => Number.isSafeInteger(item.id) && item.id > 0 && typeof (kind === 'movie' ? item.title : item.name) === 'string')
      .slice(0, 5).map((item, index) => {
        const title = kind === 'movie' ? item.title : item.name;
        const date = kind === 'movie' ? item.release_date : item.first_air_date;
        const year = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 4) : '';
        const label = `${title}${year ? ` (${year})` : ''}`;
        const canonical = `https://www.themoviedb.org/${kind}/${item.id}`;
        const template = process.env[kind === 'movie' ? 'MOVIE_URL_TEMPLATE' : 'TV_URL_TEMPLATE'];
        let target = canonical;
        if (template) {
          try {
            const destination = new URL(template.replace(/\{(id|query|title|year)\}/g, (_, field) => encodeURIComponent({ id: String(item.id), query: label, title, year }[field]).replace(/'/g, '%27')));
            if (['http:', 'https:'].includes(destination.protocol) && !destination.username && !destination.password) target = destination.href;
          } catch { /* Invalid destination configuration falls back to the TMDB detail page. */ }
        }
        return {
          suggestion: `!redirect ${target}`, title: label,
          annotation: `${kind === 'movie' ? 'Movie' : 'TV'} · TMDB${typeof item.overview === 'string' && item.overview ? ` · ${item.overview.slice(0, 220)}` : ''}`,
          image: typeof item.poster_path === 'string' && /^\/[a-zA-Z0-9_.-]+$/.test(item.poster_path) ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : '/icons/tmdb.svg',
          type: 'ENTITY', relevance: 7200 - index,
        };
      });
  } catch { return []; }
}
