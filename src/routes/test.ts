import { FastifyPluginAsync } from 'fastify';
import doh from 'dohjs';
const resolver = new doh.DohResolver('https://1.1.1.1/dns-query');

const test: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // Declare a route
  fastify.get('/test', async function (request, reply) {
    let res = '';
    const response = await resolver.query('section.io', 'ns');
    console.log(response);
    response.answers.forEach(
      (ans) =>
        (res = `
    ${res}${ans.name} ${ans.ttl} ${ans.class} ${ans.type} ${ans.data}\n
    `)
    );
    return res;
  });
};

export default test;
