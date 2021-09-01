function Suggestion(name: string, aliases: string[], url: string, favicon: string, description: string) {
  this.name = name;
  this.aliases = aliases;
  this.aliases.unshift(name);
  this.url = url;
  this.favicon = favicon;
  this.description = description;
}

const suggestions = [];
const search = `~QUERYHERE~`;
suggestions.push(new Suggestion("cluster", ["clust", "clu"], `https://aperture.section.io/ops/dashboard-proxy/${search}/dashboard/`, "kubernetes.png", "Cluster Kubernetes Dashboard"));
suggestions.push(new Suggestion("env", ["environment"], `https://aperture.section.io/ops#/environment/${search}`, "section.png", "Section Environment List"));
suggestions.push(new Suggestion("account", ["acct", "acc"], `https://aperture.section.io/ops#/account/${search}`, "section.png", "Section Account List"));
suggestions.push(new Suggestion("guru", [], `https://app.getguru.com/search?q=${search}`, "guru.png", "Guru Search"));
suggestions.push(new Suggestion("jenkins", ["j", "jen", "jenk"], `https://ci.section.io/search/?q=${search}`, "jenkins.png", "Jenkins Search"));
suggestions.push(new Suggestion("grafana", ["graf", "gf"], `https://aperture.section.io/ops/grafana/d/000000179/delivery-cluster-overview?query=${search}&search=open&orgId=5`, "grafana.png", "Grafana Search"));
suggestions.push(new Suggestion("opskibana", ["okb", "opskib", "opsk"], `https://aperture.section.io/ops/kibana/#/discover?_g=()&_a=(columns:!(_source),index:%5Baperture-%5DYYYY.MM.DD,interval:auto,query:(query_string:(analyze_wildcard:!t,lowercase_expanded_terms:!f,query:${search})),sort:!('@timestamp',desc))`, "kibana.png", "Ops Kibana Search"));
suggestions.push(new Suggestion("appskibana", ["kib", "kibana", "akb", "appskib", "appsk"], `https://aperture.section.io/ops/apps/kibana/#/discover?_g=()&_a=(columns:!(_source),index:%5Baperture-%5DYYYY.MM.DD,interval:auto,query:(query_string:(analyze_wildcard:!t,lowercase_expanded_terms:!f,query:${search})),sort:!('@timestamp',desc))`, "kibana.png", "Apps Kibana Search"));
suggestions.push(new Suggestion("appsakibana", ["kiba", "kibanaa", "aakb", "appsakib", "appsak"], `https://aperture.section.io/ops/apps/kibana-b/#/discover?_g=()&_a=(columns:!(_source),index:%5Baperture-%5DYYYY.MM.DD,interval:auto,query:(query_string:(analyze_wildcard:!t,lowercase_expanded_terms:!f,query:${search})),sort:!('@timestamp',desc))`, "kibana.png", "Apps Kibana-b Search"));
suggestions.push(new Suggestion("appsbkibana", ["kibc", "kibancb", "ackb", "appcbkib", "appcbk"], `https://aperture.section.io/ops/apps/kibana-c/#/discover?_g=()&_a=(columns:!(_source),index:%5Baperture-%5DYYYY.MM.DD,interval:auto,query:(query_string:(analyze_wildcard:!t,lowercase_expanded_terms:!f,query:${search})),sort:!('@timestamp',desc))`, "kibana.png", "Apps Kibana-c Search"));
suggestions.push(new Suggestion("org", ["private", "priv"], `https://github.com/section-io/${search}`, "github.png", "Section-io Github Org Search"));
suggestions.push(new Suggestion("public", ["pub"], `https://github.com/section/${search}`, "github.png", "Section Github Org Search"));
suggestions.push(new Suggestion("awslogin", [], `https://accounts.google.com/o/saml2/initsso?idpid=C00kh0zku&spid=467798864938&forceauthn=false`, "aws.png", "AWS Login"));
suggestions.push(new Suggestion("endpoints", ["endpoints.txt"], `https://github.com/section-io/section.delivery.endpoint/blob/master/endpoints.txt`, "github.png", "Endpoints.txt"));
suggestions.push(new Suggestion("redirect", [], `${search}`, "redirect.png", "redirect to url"));

export default suggestions;
