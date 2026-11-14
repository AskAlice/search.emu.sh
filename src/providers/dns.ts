const domain = '(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}';
const pattern = new RegExp(`^(?:dig\\s+)?(?<domain>${domain})(?:\\s+(?<DNS>A|AAAA|ALIAS|CNAME|MX|NS|PTR|SOA|SRV|TXT))?$`, 'i');

export function parseDnsQuery(query: string): { domain: string; type: string } | undefined {
  const match = query.trim().match(pattern);
  if (!match) return undefined;
  return { domain: match.groups!.domain.toLowerCase(), type: (match.groups!.DNS || 'A').toUpperCase() };
}
