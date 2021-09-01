import { FastifyPluginAsync } from "fastify";

const root: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  function makeid(length) {
    var result = "";
    var characters = " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }
  // Declare a route
  fastify.get("/random", function (request, reply) {
    reply.code(200).header("Content-Type", "text/html; charset=utf-8").send(`
    <!doctype html>
    <html>
    <head>
    <title>🙏💖🌈✨</title>
    </head>
    <body>${makeid(20480)}
    </body>
    </html>`);
  });
};

export default root;
