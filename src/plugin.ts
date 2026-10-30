import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload';
import fastifyStatic from '@fastify/static';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fastifyRacing from 'fastify-racing';
import { join } from 'path';
export type AppOptions = {} & Partial<AutoloadPluginOptions>;

const app: FastifyPluginAsync<AppOptions> = async (fastify: FastifyInstance<any>, opts): Promise<void> => {
  if (!process.env.VERCEL) {
    const [{ default: openTelemetryPlugin }, { context, trace }] = await Promise.all([
      import('@autotelic/fastify-opentelemetry'),
      import('@opentelemetry/api'),
    ]);
    await fastify.register(openTelemetryPlugin, { wrapRoutes: true });
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
  if (!process.env.VERCEL) {
    await fastify.register(fastifyStatic, {
      root: join(__dirname, 'suggestions/icons'),
      prefix: '/icons/',
    });
  }
  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
  });
};

export default app;
export { app };
