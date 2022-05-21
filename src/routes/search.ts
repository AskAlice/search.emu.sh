import { FastifyPluginAsync } from 'fastify';
import suggestions from '../suggestions';
import redirectBody from '../redirectBody';
import axios, { AxiosRequestConfig } from 'axios';
const search: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/search', async (request: any, reply) => {
    let useApiKeys: boolean = false; // query param to actually utilize the API keys specified in .env
    if (request.query?.useApiKeys === 'true') {
      useApiKeys = true;
    }
    const redirect = (url) => {
      console.log(url);
      return reply.type('text/html; charset=UTF-8').header('Referrer-Policy', 'origin').send(redirectBody(url));
    };
    let privatelySearch = false;
    const newBang = (comparisons, url) => {
      const comp = Array.from(new Set(comparisons));
      // console.log(`hostname: ${new URL(url).hostname}, comp.length: ${comp.length}, comparisons.length: ${comparisons.length}, comp.length !== comparisons.length: ${comp.length !== comparisons.length}`);
      if (comp.length !== comparisons.length) redirect(url);
    };
    if (!request.query?.q) {
      return reply.code(302).header('Location', '/');
    } else {
      const searchRegex = request.query?.q?.match(/(?<hasBang>\!?)(?<bang>(?<=\!)[\w\d-_]+)?([\s\+]+)?(?<search>.*)?/);
      const bang = searchRegex.groups.bang?.toLowerCase() || '';
      let hasBang = searchRegex.groups.hasBang === '!' ? true : false;
      console.log(`searchRegex groups: ${JSON.stringify(searchRegex.groups)}`);
      const search = searchRegex.groups.search;
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

          let classification = (await axios.request(options)).data;
          console.log(classification);
          console.log(`Text: ${search}`);
          const badCategories: Array<string> = ['Drug', 'Health', 'Sensitive Subjects'];
          privatelySearch = new RegExp(badCategories.join('|')).test(classification.label);
        } catch (e) {
          console.log('OpenAI API Error: ', e);
        }
      }
      // console.log(`Categories: ${JSON.stringify(categories)}`);

      suggestions.forEach((s) => {
        newBang([bang, ...s.aliases], s.url.replace(`~QUERYHERE~`, search));
      });
      if (!hasBang)
        if (!privatelySearch)
          // Google
          newBang([false, hasBang], `https://google.com/search?q=${encodeURIComponent(request.query.q)}`);
      // DuckDuckGo
      newBang([true, hasBang || privatelySearch], `https://duckduckgo.com/?q=${encodeURIComponent(request.query.q)}`);
    }
    newBang([true, true], `https://google.com/search?q=${encodeURIComponent(request.query.q)}`);
  });
};

export default search;
