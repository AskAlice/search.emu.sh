import axios from "axios";
import { FastifyPluginAsync } from "fastify";

import http from "http";
import https from "https";
import redirectBody from "../redirectBody";
import { getBangs, bangDestination } from "../suggestions";
import { getRichSuggestions } from "../rich";
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
const ax = axios.create({
  httpAgent, // httpAgent: httpAgent -> for non es6 syntax
  httpsAgent,
});

const search: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get("/search", async (request: any, reply) => {
    reply.header("Cache-Control", "private, no-store");
    reply.header("Vary", "Cookie");
    if (!request.query?.q) return reply.redirect("/");
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
      const custom = searchRegex.groups.hasBang === "!" && getBangs(request.headers.cookie).find(s => s.aliases.includes(bang));
      const destination = custom && bangDestination(custom, search);
      if (destination) return reply.header('Cache-Control', 'private, no-store').redirect(destination);
      const richResult = (await getRichSuggestions(request.query.q)).find((item) => item.suggestion.startsWith("!redirect "));
      if (richResult) {
        return reply.type("text/html; charset=UTF-8").header("Referrer-Policy", "origin").send(redirectBody(richResult.suggestion.slice(10)));
      }
      let hasBang = searchRegex.groups.hasBang === "!" ? true : false;
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
