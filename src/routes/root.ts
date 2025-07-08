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
    reply.code(200).header("Content-Type", "application/opensearchdescription+xml; charset=utf-8").send(`<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/"
    xmlns:moz="http://www.mozilla.org/2006/browser/search/">
  <OutputEncoding>UTF-8</OutputEncoding>
  <Image height="16" width="16" type="image/x-icon">https://${request.hostname}/favicon.ico</Image>
  <Image height="16" width="16" type="image/vnd.microsoft.icon">https://${request.hostname}/favicon.ico</Image>
  <Image height="512" width="512" type="image/png">https://${request.hostname}/logo512.png</Image>
  <ShortName>search</ShortName>
  <Description>[Search engine full name and summary]</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image height="16" width="16">https://${request.hostname}/favicon.ico</Image>
  <Url  type="text/html"
      method="GET"
      template="https://${request.hostname}/search?client=${ /Firefox/i.test(request.headers["user-agent"]) ? 'firefox' : 'chrome'}&amp;useApiKeys=true&amp;q=%s" 
  />
  <Url type="application/x-suggestions+json" method="GET" template="https://${request.hostname}/suggest?client=${ /Firefox/i.test(request.headers["user-agent"]) ? 'firefox' : 'chrome'}&amp;useApiKeys=true&amp;q=\{searchTerms\}" />
</OpenSearchDescription>`);
  }
  fastify.get("/osd.xml", osd);
  fastify.get("/opensearch.xml", osd);
}

export default root;
