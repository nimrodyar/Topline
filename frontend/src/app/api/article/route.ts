import {NextRequest,NextResponse} from 'next/server';
import {unstable_cache} from 'next/cache';
import {parseArticle,publisherUrl} from '@/lib/article-reader';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=20;
async function download(url:string,redirects=0):Promise<string> {
 const response=await fetch(url,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(7000),headers:{'User-Agent':'10TEN-News/1.0 (+https://www.10ten.news)',Accept:'text/html'}});
 if(response.status>=300&&response.status<400) {
  const target=publisherUrl(response.headers.get('location')||'',url);
  if(!target||redirects>=2) throw new Error('Unsupported redirect');return download(target,redirects+1);
 }
 if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw new Error('Article unavailable');
 const reader=response.body?.getReader();if(!reader)throw new Error('No article');
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>3000000){await reader.cancel();throw new Error('Article too large');}chunks.push(value);}
 return Buffer.concat(chunks).toString('utf8');
}
const read=unstable_cache(async(url:string)=>parseArticle(await download(url),url),['10ten-reader-v1'],{revalidate:600});
export async function GET(request:NextRequest) {
 const input=request.nextUrl.searchParams.get('url')||'';const url=publisherUrl(input);
 if(!url||!(/\/article\/|\/item\/|\/Article-|\/ty-article/i.test(new URL(url).pathname)))return NextResponse.json({error:'Unsupported article URL'},{status:400});
 try{return NextResponse.json(await read(url),{headers:{'Cache-Control':'public, s-maxage=300, stale-while-revalidate=600'}});}
 catch{return NextResponse.json({error:'The publisher could not provide this article right now'},{status:502,headers:{'Cache-Control':'no-store'}});}
}
