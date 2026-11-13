import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload';
import fastifyStatic from '@fastify/static';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fastifyRacing from 'fastify-racing';
import { join } from 'path';
import { existsSync } from 'fs';
export type AppOptions = {} & Partial<AutoloadPluginOptions>;

const app: FastifyPluginAsync<AppOptions> = async (fastify: FastifyInstance<any>, opts): Promise<void> => {
  if (!process.env.VERCEL) {
    const [{ default: openTelemetryPlugin }, { context, trace }] = await Promise.all([
      import('@autotelic/fastify-opentelemetry'),
      import('@opentelemetry/api'),
    ]);
    // Wrap only the API routes. Wrapping every route turns @fastify/static's callback-style
    // handler into an async one, and Fastify then sends an empty 200 for every static file.
    await fastify.register(openTelemetryPlugin, { wrapRoutes: ['/suggest', '/search', '/bangs'] });
    fastify.addHook('onRequest', async (request) => {
      const { activeSpan, tracer } = request.openTelemetry()
      const span = tracer.startSpan(`${(activeSpan as any).name} - child process`)
      Object.entries(request?.query || {})?.forEach(([key, value]) => span?.setAttribute(key, value));
      span?.end()
    });
    fastify.addHook('onResponse', async (request) => {
      const span = trace.getSpan(context.active());
      Object.entries(request?.query)?.forEach(([key, value]) => span?.setAttribute(key, value));
    });
  }
  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: Object.assign({}, opts),
  });
  await fastify.register(fastifyRacing, { handleError: true });
  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: Object.assign({}, opts),
    ignorePattern: /.*(model|schema)\.js/,
  });
  // Icons are normally built into dist/web/icons and served by the web root below. Registering
  // /icons/ for a folder that does not exist would shadow them with 404s.
  const iconRoot = join(__dirname, 'suggestions/icons');
  if (!process.env.VERCEL && existsSync(iconRoot)) {
    await fastify.register(fastifyStatic, {
      root: iconRoot,
      prefix: '/icons/',
    });
  }
  const webRoot = join(__dirname, '../dist/web');
  if (!process.env.VERCEL && existsSync(webRoot)) {
    await fastify.register(fastifyStatic, {
      root: webRoot,
      prefix: '/',
      decorateReply: false,
      index: false,
      // Vite content-hashes everything under /assets, so those files never change at a given URL.
      setHeaders: (res, path) => {
        if (path.startsWith(join(webRoot, 'assets'))) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    });
  }
  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
  });
};

export default app;
export { app };
