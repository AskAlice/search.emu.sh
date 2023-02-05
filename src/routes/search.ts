import axios from "axios";
import { FastifyPluginAsync } from "fastify";

import http from "http";
import https from "https";
import redirectBody from "../redirectBody";
import suggestions from "../suggestions";
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
const ax = axios.create({
  httpAgent, // httpAgent: httpAgent -> for non es6 syntax
  httpsAgent,
});

const search: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get("/search", async (request: any, reply) => {
    let useApiKeys: boolean = false; // query param to actually utilize the API keys specified in .env
    if (request.query?.useApiKeys === "true") {
      useApiKeys = true;
    }
    const searchRegex = request.query?.q?.match(/(?<hasBang>\!?)(?<bang>(?<=\!)[\w\d-_]+)?([\s\+]+)?(?<search>.*)?/);
    let search = searchRegex.groups.search;
    const bang = searchRegex.groups.bang?.toLowerCase() || "";
    if (typeof search === "undefined") search = "";
    let privatelySearch = false;
    const newBang = (comparisons, url) => {
      const comp = Array.from(new Set(comparisons));
      if (comp.length !== comparisons.length)
        return reply.type("text/html; charset=UTF-8").header("Referrer-Policy", "origin").send(redirectBody(url));
    };
    if (!request.query?.q) {
      return reply.code(302).header("Location", "/");
    } else {
      let hasBang = searchRegex.groups.hasBang === "!" ? true : false;
      suggestions.forEach((s) => {
        const a = newBang([bang, ...s.aliases], s.url.replace(`~QUERYHERE~`, search));
        if (typeof a === typeof reply) {
          return a;
        }
      });
      if (hasBang) {
        const a = newBang([true, hasBang], `https://duckduckgo.com/?q=${encodeURIComponent(request.query.q)}`);
        if (typeof a === typeof reply) {
          return a;
        }
      }
      // console.log(`searchRegex groups: ${JSON.stringify(searchRegex.groups)}`);

      if (!hasBang) {
        if (!privatelySearch) {
          const a = newBang([false, hasBang], `https://google.com/search?q=${encodeURIComponent(request.query.q)}`);
          if (typeof a === typeof reply) {
            return a;
          }
        }
        // DuckDuckGo
        const b = newBang([true, hasBang || privatelySearch], `https://duckduckgo.com/?q=${encodeURIComponent(request.query.q)}`);
        if (typeof b === typeof reply) {
          return b;
        }
      }
    }
    const c = newBang([true, true], `https://google.com/search?q=${encodeURIComponent(request.query.q)}`);
    if (typeof c === typeof reply) {
      return c;
    }
  });
};

export default search;
