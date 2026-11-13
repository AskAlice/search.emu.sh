import { FastifyPluginAsync } from 'fastify';
import defaults, { BANG_COOKIE, getBangs, validateBangs } from '../suggestions';

const bangs: FastifyPluginAsync = async fastify => {
  fastify.get('/bangs', async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    return { bangs: getBangs(request.headers.cookie), defaults };
  });
  fastify.post('/bangs', async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    const protocol = process.env.VERCEL ? 'https' : request.protocol;
    const origin = request.headers.origin;
    if (origin && origin !== `${protocol}://${request.headers.host}`) return reply.code(403).send({ error: 'Save settings on the search site itself.' });
    try {
      const bangs = validateBangs(request.body);
      const value = encodeURIComponent(JSON.stringify(bangs));
      if (value.length > 3500) throw new Error('Settings exceed the cookie size limit. Remove or shorten some bangs.');
      reply.header('Set-Cookie', `${BANG_COOKIE}=${value}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${protocol === 'https' ? '; Secure' : ''}`);
      return { bangs };
    } catch (error) { return reply.code(400).send({ error: error.message }); }
  });
};
export default bangs;
