import { FastifyPluginAsync } from 'fastify';
import axios from 'axios';
import { validImageSignature } from '../omnibox-image';

// Same-origin copy of a suggestion image (see omniboxImage). Cached at the edge for a week.
const img: FastifyPluginAsync = async (fastify) => {
  fastify.get('/img', async (request: any, reply) => {
    const { u, s } = request.query ?? {};
    if (typeof u !== 'string' || typeof s !== 'string' || !validImageSignature(u, s)) return reply.code(403).send();
    try {
      const response = await axios.get(u, {
        responseType: 'arraybuffer', timeout: 3000, maxContentLength: 2_000_000, maxRedirects: 3,
        headers: { Accept: 'image/*', 'User-Agent': 'Mozilla/5.0 (compatible; emu-search image proxy)' },
      });
      const type = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      if (!type.startsWith('image/') || type.includes('svg')) return reply.code(415).header('Cache-Control', 'public, max-age=3600').send();
      return reply
        .header('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400')
        .type(type)
        .send(Buffer.from(response.data));
    } catch {
      return reply.code(502).header('Cache-Control', 'public, max-age=300').send();
    }
  });
};

export default img;
