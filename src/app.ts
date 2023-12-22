//
//
import openTelemetryPlugin from '@autotelic/fastify-opentelemetry';
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload';
import fastifyStatic from '@fastify/static';
import { context, trace } from '@opentelemetry/api';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fastifyRacing from 'fastify-racing';
import { join } from 'path';
export type AppOptions = {} & Partial<AutoloadPluginOptions>;

// const ServerOptions: RawServerBase = {
//   http2: true,
// };

const app: FastifyPluginAsync<AppOptions> = async (fastify: FastifyInstance<any>, opts): Promise<void> => {

  // fastify.
  await fastify.register(openTelemetryPlugin, { wrapRoutes: true });
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
  await fastify.register(fastifyStatic, {
    root: join(__dirname, 'suggestions/icons'),
    prefix: '/icons/',
  });
  fastify.addHook('onRequest', async (request) => {
    const {
      activeSpan,
      tracer,
      // context,
      // extract,
      // inject,
    } = request.openTelemetry()
    // Spans started in a wrapped route will automatically be children of the activeSpan.
    const span = tracer.startSpan(`${(activeSpan as any).name} - child process`)
    console.log(context, 'trace:', trace, request.url);
    Object.entries(request?.query || {})?.forEach(([key, value]) => {
      if(span?.setAttribute)
        span?.setAttribute(key, value);
    });
    span?.end()

  });
  fastify.addHook('onResponse', async (request) => {
    const span = trace.getSpan(context.active());
    Object.entries(request?.query)?.forEach(([key, value]) => {
      if(span?.setAttribute)
        span?.setAttribute(key, value);
    });
  });
  // fastify.use((req, res, next) => {
  //   const span = trace.getSpan(context.active());
  //   span.setAttribute('order', 1);
  //   next();
  // });
  // if (process.env.NODE_ENV === "production") {
  //   fastify.register(fastifyStatic, {
  //     root: join(__dirname, "frontend/build"),
  //     prefix: "/",
  //     decorateReply: false, // the reply decorator has been added by the first plugin registration
  //   });
  // }
};

export default app;
export { app };

