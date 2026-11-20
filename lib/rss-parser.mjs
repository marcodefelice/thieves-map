import { XMLParser, XMLValidator } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, cdataPropName: '__cdata', parseTagValue: false, trimValues: true, processEntities: true });
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
function content(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(content).join(' ').trim();
  if (typeof value === 'object') return [value['#text'], value.__cdata].filter(Boolean).join(' ').trim();
  return String(value).trim();
}
export function parseRss(bytes) {
  if (bytes.length > 2_000_000) throw new Error('Feed too large');
  const xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid or unsafe XML');
  const root = parser.parse(xml);
  const entries = array(root.rss?.channel?.item ?? root.feed?.entry ?? root.RDF?.item);
  return entries.slice(0, 300).map(entry => {
    const links = array(entry.link);
    const link = links.find(item => typeof item !== 'object' || !item['@_rel'] || item['@_rel'] === 'alternate');
    return { title: content(entry.title), link: typeof link === 'object' ? link['@_href'] || content(link) : content(link), description: content(entry.description), summary: content(entry.summary), content: content(entry.content || entry.encoded), pubdate: content(entry.pubDate || entry.pubdate), published: content(entry.published), date: content(entry.date) };
  });
}
