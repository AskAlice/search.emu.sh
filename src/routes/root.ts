import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
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
  const osd = (request, reply)  => {
    // Firefox needs plain JSON suggestions (no XSSI prefix), which client=firefox selects.
    const client = /Firefox/i.test(request.headers["user-agent"] || '') ? 'firefox' : 'chrome';
    reply.code(200).header("Content-Type", "application/opensearchdescription+xml; charset=utf-8").send(`<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/"
    xmlns:moz="http://www.mozilla.org/2006/browser/search/">
  <ShortName>emu search</ShortName>
  <Description>emu search: bangs, rich suggestions and instant answers</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <OutputEncoding>UTF-8</OutputEncoding>
  <Image height="16" width="16" type="image/svg+xml">https://${request.hostname}/favicon.svg</Image>
  <Url type="text/html" method="GET" template="https://${request.hostname}/search?client=${client}&amp;q={searchTerms}" />
  <Url type="application/x-suggestions+json" method="GET" template="https://${request.hostname}/suggest?client=${client}&amp;q={searchTerms}" />
</OpenSearchDescription>`);
  }
  fastify.get("/osd.xml", osd);
  fastify.get("/opensearch.xml", osd);
  fastify.get("/", async (request, reply) => {
    const index = join(__dirname, '../../dist/web/index.html');
    if (!process.env.VERCEL && existsSync(index)) return reply.type('text/html').send(await readFile(index));
    return { root: true };
  });
}

export default root;
