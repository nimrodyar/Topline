import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import Parser from 'rss-parser';
import { load } from 'cheerio';
import { Article, buildStories } from '@/lib/stories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Source = { name: string; feed?: string; page: string; category?: string; updates?: boolean };
const sources: Source[] = [
  { name: 'ynet', feed: 'https://www.ynet.co.il/Integration/StoryRss2.xml', page: 'https://www.ynet.co.il/news' },
  { name: 'ynet', feed: 'https://www.ynet.co.il/Integration/StoryRss1854.xml', page: 'https://www.ynet.co.il/news/category/184', updates: true },
  ...[['6','business'],['3','sports'],['544','technology'],['538','entertainment'],['1208','health']].map(([id,category]) => ({ name: 'ynet', feed: `https://www.ynet.co.il/Integration/StoryRss${id}.xml`, page: 'https://www.ynet.co.il/', category })),
  { name: 'walla', feed: 'https://rss.walla.co.il/feed/1', page: 'https://news.walla.co.il/' },
  { name: 'mako', feed: 'https://rcs.mako.co.il/rss/news-military.xml', page: 'https://www.mako.co.il/news-military', category: 'politics' },
  { name: 'mako', feed: 'https://rcs.mako.co.il/rss/news-money.xml', page: 'https://www.mako.co.il/finances', category: 'business' },
  { name: 'mako', feed: 'https://rcs.mako.co.il/rss/cd0c4e8fc83b8310VgnVCM2000002a0c10acRCRD.xml', page: 'https://www.mako.co.il/nexter', category: 'technology' },
  { name: 'haaretz', feed: 'https://www.haaretz.co.il/srv/htz---all-articles', page: 'https://www.haaretz.co.il/' },
  { name: 'n12', page: 'https://www.n12.co.il/' },
];
const categories = ['all','general','politics','business','technology','sports','entertainment','health','science'];
const keywords: Record<string, RegExp> = {
  sports: /כדורגל|כדורסל|ליגת|אליפות|ספורט|מכבי|הפועל/,
  technology: /טכנולוג|סייבר|אפל|גוגל|בינה מלאכותית|סטארטאפ|אייפון/,
  business: /כלכל|בורסה|מניות|בנק|ריבית|כספים|עסקים/,
  health: /בריאות|רפוא|רופא|מחלה|חיסון|סרטן/,
  science: /מדע|חלל|נאס"א|כוכב|אסטרונומ/,
  entertainment: /בידור|תרבות|זמר|שחקנית|סלב|מוזיקה|סדרה/,
  politics: /ממשלה|כנסת|בחירות|שר הביטחון|ראש הממשלה|נתניהו|פוליטי/,
};
const parser = new Parser({ customFields: { item: [['media:content','media', { keepArray: true }], ['media:thumbnail','thumbnails', { keepArray: true }]] } });
function text(value: string) { const $=load(value);$('script,style').remove();return $.text().replace(/\s+/g,' ').trim(); }
function safeUrl(value: unknown, base: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, base);
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    if(url.hostname==='img.haarets.co.il' && url.searchParams.has('width') && Number(url.searchParams.get('width'))<600) {
      url.searchParams.set('width','960');url.searchParams.set('height','540');
    }
    for (const key of Array.from(url.searchParams.keys())) if (/^utm_|^(fbclid|gclid|partner|ref)$/i.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch { return null; }
}
function date(value: unknown) {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  // Never turn undated/invalid items into apparently fresh news.
  return Number.isFinite(timestamp) && timestamp <= Date.now() + 300000 ? new Date(timestamp).toISOString() : null;
}
function category(title: string, fallback?: string) { return fallback || Object.entries(keywords).find(([, re]) => re.test(title))?.[0] || 'general'; }
function publisherUrl(value: unknown, source: Source) {
  const url = safeUrl(value, source.page);
  if (!url) return null;
  const host = new URL(url).hostname;
  return ['ynet.co.il','walla.co.il','mako.co.il','n12.co.il','haaretz.co.il'].some(domain => host === domain || host.endsWith('.' + domain)) ? url : null;
}
async function download(url: string) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8500), headers: { 'User-Agent': '10TEN-News/1.0 (+https://www.10ten.news)', Accept: 'application/rss+xml, application/atom+xml, text/xml, text/html' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty response');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const {value,done} = await reader.read(); if (done) break;
    size += value.length; if (size > 3000000) { await reader.cancel(); throw new Error('Response too large'); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
async function rss(source: Source): Promise<Article[]> {
  if (!source.feed) return [];
  const feed = await parser.parseString(await download(source.feed));
  return feed.items.slice(0,100).flatMap(entry => {
    const url = publisherUrl(entry.link, source); const title = text(entry.title || '');
    if (!url || title.length < 8) return [];
    const custom = entry as typeof entry & { media?: { $?: { url?: string } }[]; thumbnails?: { $?: { url?: string } }[] };
    const image = custom.media?.[0]?.$?.url || custom.thumbnails?.[0]?.$?.url || (entry.enclosure?.type?.startsWith('image/') ? entry.enclosure.url : null) || load(entry.content || entry.summary || '')('img').first().attr('src');
    return [{ title, url, description: text(entry.contentSnippet || entry.summary || entry.content || '').slice(0,1600), source: source.name, image_url: safeUrl(image, source.page), published_at: date(entry.isoDate || entry.pubDate), category: category(title,source.category), type: source.updates ? 'update' : 'rss' }];
  });
}
async function scrape(source: Source): Promise<Article[]> {
  const $ = load(await download(source.page));
  const articles: Article[] = [];
  // Read only public listing metadata; do not fetch or reproduce full articles.
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const walk = (node: unknown) => {
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (!node || typeof node !== 'object') return;
        const item = node as Record<string, unknown>;
        const url = publisherUrl(item.url || item['@id'], source);
        const title = typeof item.headline === 'string' ? text(item.headline) : '';
        if (url && title.length >= 8) {
          const image = Array.isArray(item.image) ? item.image[0] : item.image;
          articles.push({title,url,description:typeof item.description==='string'?text(item.description).slice(0,1600):'',source:source.name,image_url:safeUrl(typeof image === 'object' && image ? (image as Record<string,unknown>).url : image,source.page),published_at:date(item.datePublished),category:category(title,source.category),type:'listing'});
        }
        Object.values(item).forEach(walk);
      };
      walk(JSON.parse($(script).text()));
    } catch { /* Invalid publisher metadata is isolated. */ }
  });
  $('a[href]').each((_, anchor) => {
    const el = $(anchor); const url = publisherUrl(el.attr('href'), source);
    if (!url || !/\/article\/|\/item\/|\/Article-|\/ty-article\//i.test(new URL(url).pathname)) return;
    const heading = el.find('h1,h2,h3,h4').first().text();
    const title = text(heading || el.attr('title') || el.text());
    if (title.length < 12 || title.length > 220) return;
    const time = el.find('time').attr('datetime');
    articles.push({title,url,source:source.name,image_url:safeUrl(el.find('img').first().attr('src'),source.page),published_at:date(time),category:category(title,source.category),type:'listing'});
  });
  return articles.slice(0,100);
}
const lastGood = new Map<string, Article[]>();
async function collect(source: Source) {
  const key = source.feed || source.page;
  let data: Article[] = []; let error = '';
  try { data = await rss(source); } catch (e) { error = e instanceof Error ? e.message : 'Feed unavailable'; }
  if (!data.length) {
    try { data = await scrape(source); } catch (e) { error = e instanceof Error ? e.message : 'Listing unavailable'; }
  }
  if (data.length) lastGood.set(key,data);
  return {source:source.name, feed:source.feed || source.page, status: data.length ? 'ok' : lastGood.has(key) ? 'stale' : 'unavailable', count:data.length, error: data.length ? undefined : error || 'No articles found', data:data.length ? data : lastGood.get(key) || []};
}
const aggregate = unstable_cache(async () => {
  const results = await Promise.all(sources.map(collect));
  const seen = new Set<string>();
  const data = results.flatMap(result => result.data).sort((a,b) => (Date.parse(b.published_at || '') || 0) - (Date.parse(a.published_at || '') || 0)).filter(item => {
    if (item.published_at && Date.now() - Date.parse(item.published_at) > 7 * 86400000) return false;
    const key = item.url; const titleKey = `${item.source}:${item.title.replace(new RegExp('[\\s\\p{P}]','gu'),'')}`;
    if (seen.has(key) || seen.has(titleKey)) return false;
    seen.add(key); seen.add(titleKey); return true;
  });
  // Throwing preserves the previous persistent cache during a total outage.
  if (!data.length) throw new Error('All news sources are unavailable');
  const stories = buildStories(data);
  // Only enrich missing images on the newest article in visible multi-source stories.
  // An older report's image is never silently substituted for the newest report.
  await Promise.all(stories.filter(story=>story.source_count>1 && !story.image_url).slice(0,8).map(async story=>{
    try {
      const $=load(await download(story.url));
      const image=safeUrl($('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content'),story.url);
      if(image) {story.image_url=image;story.image_source=story.source;story.image_article_url=story.url;story.image_published_at=story.published_at;}
    } catch { /* Keep an honest no-image fallback. */ }
  }));
  return {data:stories,sources:results.map(({data:_,...result})=>result),fetched_at:new Date().toISOString(),article_total:data.length,multi_source_total:stories.filter(story=>story.source_count>1).length};
}, ['10ten-aggregator-stories-v2'], { revalidate: 120 });

export async function GET(request: NextRequest) {
  const endpoint = request.nextUrl.pathname.split('/').filter(Boolean)[1];
  if (endpoint === 'categories') return NextResponse.json({categories});
  if (!['news','trending','aggregate','health'].includes(endpoint)) return NextResponse.json({error:'Not found'}, {status:404});
  const selected = request.nextUrl.searchParams.get('category') || 'all';
  const page = Number(request.nextUrl.searchParams.get('page') || 1);
  if (!categories.includes(selected) || !Number.isInteger(page) || page < 1 || page > 100) return NextResponse.json({error:'Invalid category or page'}, {status:400});
  try {
    const result = await aggregate();
    const items = selected === 'all' ? result.data : result.data.filter(item=>item.category===selected);
    const start = (page-1)*20;
    const response = endpoint === 'health' ? {status:result.sources.some(s=>s.status!=='ok') ? 'degraded' : 'ok',sources:result.sources,fetched_at:result.fetched_at,total:result.data.length,article_total:result.article_total,multi_source_total:result.multi_source_total}
      : endpoint === 'aggregate' ? result
      : {data:endpoint==='trending' ? items.slice(0,5) : items.slice(start,start+20),has_more:start+20<items.length,total:items.length,multi_source_total:result.multi_source_total,fetched_at:result.fetched_at,sources:result.sources};
    return NextResponse.json(response,{headers:{'Cache-Control':'public, s-maxage=60, stale-while-revalidate=300'}});
  } catch {
    return NextResponse.json({error:'News sources are temporarily unavailable',data:[]},{status:503,headers:{'Cache-Control':'no-store','Retry-After':'60'}});
  }
}
