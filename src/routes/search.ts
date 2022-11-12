import axios, { AxiosRequestConfig } from 'axios';
import { FastifyPluginAsync } from 'fastify';
import http from 'http';
import https from 'https';
import redirectBody from '../redirectBody';
import suggestions from '../suggestions';
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
const ax = axios.create({
  httpAgent, // httpAgent: httpAgent -> for non es6 syntax
  httpsAgent,
});

const search: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/search', async (request: any, reply) => {
    let useApiKeys: boolean = false; // query param to actually utilize the API keys specified in .env
    if (request.query?.useApiKeys === 'true') {
      useApiKeys = true;
    }
    const searchRegex = request.query?.q?.match(/(?<hasBang>\!?)(?<bang>(?<=\!)[\w\d-_]+)?([\s\+]+)?(?<search>.*)?/);
    let search = searchRegex.groups.search;
    const bang = searchRegex.groups.bang?.toLowerCase() || '';
    if (typeof search === 'undefined') search = '';
    let privatelySearch = false;
    const newBang = (comparisons, url) => {
      const comp = Array.from(new Set(comparisons));
      if (comp.length !== comparisons.length)
        return reply.type('text/html; charset=UTF-8').header('Referrer-Policy', 'origin').send(redirectBody(url));
    };
    if (!request.query?.q) {
      return reply.code(302).header('Location', '/');
    } else {
      let hasBang = searchRegex.groups.hasBang === '!' ? true : false;
      if (hasBang) {
        const a = newBang([true, hasBang], `https://duckduckgo.com/?q=${encodeURIComponent(request.query.q)}`);
        if (typeof a === typeof reply) {
          return a;
        }
      }
      suggestions.forEach((s) => {
        const a = newBang([bang, ...s.aliases], s.url.replace(`~QUERYHERE~`, search));
        if (typeof a === typeof reply) {
          return a;
        }
      });
      console.log(`searchRegex groups: ${JSON.stringify(searchRegex.groups)}`);

      if (useApiKeys && typeof process?.env?.OPENAI_API_KEY !== 'undefined' && process?.env?.OPENAI_API_KEY?.length) {
        try {
          let url = 'https://api.openai.com/v1/classifications';
          let labels = ['Neutral', 'Health', 'Sensitive Subjects', 'Drug'];
          let trainingExamples = [
            ['LSD', 'Drug'],
            ['Why do I have back pain', 'Health'],
            ['covid cases', 'Neutral'],
            [`Ehler's Danlos`, 'Health'],
            ['pseudoxanthoma elasticum', 'Health'],
            [`Ehler's Danlos Syndrome`, 'Health'],
            ['darknet', 'Sensitive Subjects'],
            ['covid test sites', 'Neutral'],
            ['covid', 'Health'],
            ['cvs near me', 'Neutral'],
            ['Sex', 'Sensitive Subjects'],
          ];
          let options: AxiosRequestConfig = {
            method: 'POST',
            httpsAgent,
            httpAgent,
            url,
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            data: `{"examples":${JSON.stringify(trainingExamples)},"query":"${request.query.q.replace(
              /['#$^%&\*\;\\|\<\>\+\_\,!\(\)]+/g,
              ''
            )}","search_model":"ada","model":"curie","labels":${JSON.stringify(labels)}}`,
          };

          let classification = (await ax.request(options)).data;
          console.log(classification);
          console.log(`Text: ${search}`);
          const badCategories: Array<string> = ['Drug', 'Health', 'Sensitive Subjects'];
          privatelySearch = new RegExp(badCategories.join('|')).test(classification.label);
        } catch (e) {
          console.log('OpenAI API Error: ', e);
        }
      }
      // console.log(`Categories: ${JSON.stringify(categories)}`);

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
