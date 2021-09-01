import { join } from "path";
import AutoLoad, { AutoloadPluginOptions } from "fastify-autoload";
import { FastifyPluginAsync } from "fastify";
import fastifyStatic from "fastify-static";
export type AppOptions = {
  // Place your custom options for app below here.
} & Partial<AutoloadPluginOptions>;

const app: FastifyPluginAsync<AppOptions> = async (fastify, opts): Promise<void> => {
  fastify.register(AutoLoad, {
    dir: join(__dirname, "plugins"),
    options: Object.assign({}, opts),
  });

  fastify.register(AutoLoad, {
    dir: join(__dirname, "routes"),
    options: Object.assign({}, opts),
    ignorePattern: /.*(model|schema)\.js/,
  });
  fastify.register(fastifyStatic, {
    root: join(__dirname, "suggestions/icons"),
    prefix: "/icons/",
  });
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
