import {NextResponse} from 'next/server';
import {unstable_cache} from 'next/cache';
import Parser from 'rss-parser';
import {load} from 'cheerio';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=12;
const read=unstable_cache(async()=>{
 const response=await fetch('https://www.ynet.co.il/Integration/StoryRss1854.xml',{cache:'no-store',signal:AbortSignal.timeout(6500),headers:{'User-Agent':'10TEN-News/1.0 (+https://www.10ten.news)'}});
 if(!response.ok)throw new Error('Flash feed unavailable');
 const xml=await response.text();if(xml.length>1500000)throw new Error('Feed too large');
 const feed=await new Parser().parseString(xml);
 const seen=new Set<string>();
 const data=feed.items.flatMap(entry=>{
  let url:URL;try{url=new URL(entry.link||'');}catch{return [];}
  if(url.protocol!=='https:'||!(url.hostname==='ynet.co.il'||url.hostname.endsWith('.ynet.co.il')))return [];
  const title=load(entry.title||'').text().replace(/\s+/g,' ').trim();const date=Date.parse(entry.isoDate||entry.pubDate||'');
  if(!title||!Number.isFinite(date)||date>Date.now()+300000||Date.now()-date>48*3600000||seen.has(url.toString()))return [];
  seen.add(url.toString());
  return [{title,url:url.toString(),source:'ynet',description:load(entry.contentSnippet||entry.content||'').text(),image_url:null,published_at:new Date(date).toISOString(),category:'general',type:'update',breaking:/דחוף|breaking news/i.test(title)}];
 }).sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at)).slice(0,12);
 if(!data.length)throw new Error('No current flashes');
 return {data,fetched_at:new Date().toISOString()};
},['10ten-flashes-v1'],{revalidate:30});
export async function GET(){try{return NextResponse.json(await read(),{headers:{'Cache-Control':'public, s-maxage=15, stale-while-revalidate=60'}});}catch{return NextResponse.json({data:[],error:'Flash feed unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}}
