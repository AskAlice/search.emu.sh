import { FastifyPluginAsync } from 'fastify';
import { LanguageServiceClient } from '@google-cloud/language';
import { google } from '@google-cloud/language/build/protos/protos';
import suggestions from '../suggestions';
const client = new LanguageServiceClient();

const search: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get('/search', async (request: any, reply) => {
    const redirect = (url) => {
      console.log(url);
      reply.header('Referrer-Policy', 'no-referrer').redirect(302, url);
    };
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
      let classifyResult: any = { categories: [] };
      if (typeof process?.env?.GOOGLE_APPLICATION_CREDENTIALS !== 'undefined' && process?.env?.GOOGLE_APPLICATION_CREDENTIALS?.length) {
        const document: google.cloud.language.v1.IDocument = {
          content: `${search} ${search} ${search} ${search} ${search} ${search} ${search} ${search} ${search} ${search}
                  ${search} ${search} ${search} ${search} ${search} ${search} ${search} ${search} ${search} ${search}`,
          type: 'PLAIN_TEXT',
          language: 'en-US',
        };

        // Detects the sentiment of the text

        try {
          const classify: any = await client.classifyText({ document: document });
          console.log(Object.getOwnPropertyNames(classify));
          console.log('hi');
          console.log(Object.keys(classify), classify[0], classify[1], classify[2], JSON.stringify(classify));
          console.log(classify.categories);
          classifyResult = classify[0];
        } catch (e) {
          console.log(e);
        }
      }
      const categories = typeof classifyResult !== 'undefined' ? classifyResult?.categories : [];

      console.log(`Text: ${search}`);
      console.log(`Categories: ${JSON.stringify(categories)}`);

      suggestions.forEach((s) => {
        newBang([bang, ...s.aliases], s.url.replace(`~QUERYHERE~`, search));
      });
      // newBang([bang, "cluster", "clust", "clu"], `https://aperture.section.io/ops/dashboard-proxy/${search}/dashboard/`);
      // newBang([bang, "env", "environment"], `https://aperture.section.io/ops#/environment/${search}`);
      // newBang([bang, "account", "acct", "acc"], `https://aperture.section.io/ops#/account/${search}`);
      // newBang([bang, "guru"], `https://app.getguru.com/search?q=${search}`);
      // newBang([bang, "jenkins", "j", "jen", "jenk"], `https://ci.section.io/search/?q=${search}`);
      // newBang([bang, "grafana", "graf", "gf"], `https://aperture.section.io/ops/grafana/d/000000179/delivery-cluster-overview?query=${search}&search=open&orgId=5`);
      // newBang([bang, "opskibana", "okb", "opskib", "opsk"], `https://aperture.section.io/ops/kibana/#/discover?_g=()&_a=(columns:!(_source),index:%5Baperture-%5DYYYY.MM.DD,interval:auto,query:(query_string:(analyze_wildcard:!t,lowercase_expanded_terms:!f,query:${search})),sort:!('@timestamp',desc))`);
      // newBang([bang, "appskibana", , "kib", "kibana", "akb", "appskib", "appsk"], `https://aperture.section.io/ops/apps/kibana/#/discover?_g=()&_a=(columns:!(_source),index:%5Baperture-%5DYYYY.MM.DD,interval:auto,query:(query_string:(analyze_wildcard:!t,lowercase_expanded_terms:!f,query:${search})),sort:!('@timestamp',desc))`);
      // newBang([bang, "appsakibana", "kiba", "kibanaa", "aakb", "appsakib", "appsak"], `https://aperture.section.io/ops/apps/kibana-b/#/discover?_g=()&_a=(columns:!(_source),index:%5Baperture-%5DYYYY.MM.DD,interval:auto,query:(query_string:(analyze_wildcard:!t,lowercase_expanded_terms:!f,query:${search})),sort:!('@timestamp',desc))`);
      // newBang([bang, "appsbkibana", "kibc", "kibancb", "ackb", "appcbkib", "appcbk"], `https://aperture.section.io/ops/apps/kibana-c/#/discover?_g=()&_a=(columns:!(_source),index:%5Baperture-%5DYYYY.MM.DD,interval:auto,query:(query_string:(analyze_wildcard:!t,lowercase_expanded_terms:!f,query:${search})),sort:!('@timestamp',desc))`);
      // newBang([bang, "public", "pub", "org"], `https://github.com/section-io/${search}`);
      // newBang([bang, "private", "priv"], `https://github.com/section/${search}`);
      // newBang([bang, "awslogin"], `https://accounts.google.com/o/saml2/initsso?idpid=C00kh0zku&spid=467798864938&forceauthn=false`);
      // newBang([bang, "endpoints.txt"], `https://github.com/section-io/section.delivery.endpoint/blob/master/endpoints.txt`);
      // see https://cloud.google.com/natural-language/docs/categories
      if (!hasBang && Array.isArray(categories)) {
        categories.forEach((c) => {
          const badCategories: Array<string> = ['Sensitive Subjects', 'Medical', 'Health', 'Pharmacy', 'Medications', 'Drugs'];
          hasBang = new RegExp(badCategories.join('|')).test(c.name);
        });
      }
      // Google
      newBang([false, hasBang], `https://google.com/search?q=${encodeURIComponent(request.query.q)}`);
      // DuckDuckGo
      newBang([true, hasBang], `https://duckduckgo.com/?q=${encodeURIComponent(request.query.q)}`);
    }
    return { hello: 'world' };
  });
};

export default search;
