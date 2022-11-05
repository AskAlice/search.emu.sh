import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload';
import fastifyStatic from '@fastify/static';
import { context, trace } from '@opentelemetry/api';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { join } from 'path';
import { tracer as tracing } from './tracing';
const openTelemetryPlugin = require('@autotelic/fastify-opentelemetry');

export type AppOptions = {} & Partial<AutoloadPluginOptions>;

// const ServerOptions: RawServerBase = {
//   http2: true,
// };
const app: FastifyPluginAsync<AppOptions> = async (fastify: FastifyInstance<any>, opts): Promise<void> => {
  tracing.startSpan('main');
  // fastify.
  await fastify.register(openTelemetryPlugin, { wrapRoutes: true });
  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: Object.assign({}, opts),
  });

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
    const span = tracing.startSpan(request?.routerPath);
    // console.log(context, 'trace:', trace, request.url);
    span.setAttribute('order', request.ip);
  });
  fastify.addHook('onResponse', async (request) => {
    const span = trace.getSpan(context.active());
    // console.log(span, context, 'trace:', trace, request.url);
    span?.end();
    // span.setAttribute('order', request.ip);
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
