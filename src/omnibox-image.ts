import { createHmac, timingSafeEqual } from 'crypto';

// Signing keeps /img from being an open proxy: it only serves URLs this server put in a suggestion.
const SECRET = process.env.IMG_PROXY_SECRET || 'emu-search-image-proxy';
export const signImage = (url: string) => createHmac('sha256', SECRET).update(url).digest('base64url').slice(0, 22);
export const validImageSignature = (url: string, signature: string) => {
  const expected = Buffer.from(signImage(url));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
};

/**
 * Brave (and Chromium) only draw omnibox suggestion images that are bitmaps from the search engine's own
 * origin: SVGs and images on other hosts show a blank colored square or nothing. So SVG icons map to their
 * pre-rendered PNGs in public/icons, and remote images go through the signed /img proxy.
 */
export function omniboxImage(raw: string | undefined, host: string): string | undefined {
  if (!raw) return undefined;
  let url: URL;
  try { url = new URL(raw, `https://${host}`); } catch { return undefined; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
  if (url.host === host) {
    const chromium = url.pathname.match(/^\/icon\/chromium\/(\w+)\.svg$/);
    if (chromium) return `https://${host}/icons/chromium/${chromium[1]}.png`;
    const glyph = url.pathname.match(/^\/icon\/([^/]+)\.svg$/);
    if (glyph) return `https://${host}/icons/glyph/${glyph[1].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'EMU'}.png`;
    return url.href;
  }
  const flag = url.hostname === 'flagcdn.com' && url.pathname.match(/^\/([a-z]{2})\.svg$/);
  if (flag) url = new URL(`https://flagcdn.com/w80/${flag[1]}.png${url.search}`);
  return `https://${host}/img?u=${encodeURIComponent(url.href)}&s=${signImage(url.href)}`;
}
