import { load } from 'cheerio';
export type ReaderContent = {title:string;url:string;summary:string[];paragraphs:string[];limited:boolean;truncated:boolean;print_url:string|null;word_count:number};
const domains=['ynet.co.il','walla.co.il','mako.co.il','n12.co.il','haaretz.co.il'];
export function publisherUrl(input:string,base?:string) {
  try {const url=new URL(input,base);if(url.protocol!=='https:'||url.port||url.username||url.password||!domains.some(d=>url.hostname===d||url.hostname.endsWith('.'+d))) return null;url.hash='';return url.toString();}catch{return null;}
}
export function parseArticle(html:string,url:string):ReaderContent {
 const $=load(html);let body='';let restricted=url.includes('/.premium/');
 const title=$('meta[property="og:title"]').attr('content')||$('h1').first().text()||'';
 const description=$('meta[property="og:description"]').attr('content')||$('meta[name="description"]').attr('content')||'';
 const clean=(value:string)=>load(value).text().replace(/\s+/g,' ').trim();
 $('script[type="application/ld+json"]').each((_,el)=>{
  try {const walk=(node:unknown)=>{
   if(Array.isArray(node)){node.forEach(walk);return;}if(!node||typeof node!=='object')return;
   const item=node as Record<string,unknown>;
   const type=String(item['@type']||'');
   if(/Article|Reportage|News/i.test(type)) {
    if(item.isAccessibleForFree===false||item.isAccessibleForFree==='false') restricted=true;
    if(typeof item.articleBody==='string'&&item.articleBody.length>body.length) body=item.articleBody;
   }
   Object.values(item).forEach(walk);
  };walk(JSON.parse($(el).text()));}catch{}
 });
 if($('[itemprop="isAccessibleForFree"][content="false"], [data-paywall="true"], .paywall-active').length) restricted=true;
 let print_url:string|null=null;
 $('a[href],link[href]').each((_,el)=>{
  const href=$(el).attr('href')||'';const type=$(el).attr('type')||'';const label=$(el).text();
  if(!print_url && (/application\/pdf/i.test(type)||/\.pdf(?:\?|$)/i.test(href)||/^(?:גרסה להדפסה|הדפסה|Print version|Print article)$/i.test(label.trim()))) print_url=publisherUrl(href,url);
 });
 $('script,style,nav,footer,aside,form,button,iframe,.comments,.related,.recommendations,[aria-hidden="true"],.advertisement').remove();
 let paragraphs:string[]=[];
 if(!restricted) {
  if(body) paragraphs=body.split(/\n+/).map(clean).filter(p=>p.length>35);
  if(paragraphs.length<2) {
   const candidates=['[itemprop="articleBody"]','.article-body','.article__body','.article-content','.articleBody','.text_editor','[data-testid="article-body"]','article'];
   for(const selector of candidates) {
    const extracted=$(selector).find('p').map((_,p)=>$(p).text().replace(/\s+/g,' ').trim()).get().filter(p=>p.length>45);
    if(extracted.length>paragraphs.length) paragraphs=extracted;
   }
  }
 }
 paragraphs=paragraphs.flatMap(paragraph=>{
  if(paragraph.length<800)return [paragraph];
  const words=paragraph.split(/\s+/);const chunks:string[]=[];
  for(let i=0;i<words.length;i+=85)chunks.push(words.slice(i,i+85).join(' '));
  return chunks;
 });
 paragraphs=Array.from(new Set(paragraphs)).filter(p=>!/^פרסומת|^כתבות נוספות|^קראו עוד|^הרשמה ל|^הירשמו ל/.test(p));
 const available=paragraphs.join('\n');const truncated=available.length>18000;
 let size=0;paragraphs=paragraphs.filter(p=>{size+=p.length;return size<=18000;});
 const limited=restricted||available.length<180;
 if(restricted) paragraphs=[];
 const summaryText=limited?clean(description):paragraphs.slice(0,5).join(' ');
 const sentences=summaryText.split(/(?<=[.!?])\s+/).filter(s=>s.length>35);
 const summary:string[]=[];let words=0;
 for(const sentence of sentences.length?sentences:[summaryText]){const n=sentence.split(/\s+/).length;if(words+n>110)break;if(sentence){summary.push(sentence);words+=n;}if(summary.length===3)break;}
 if(!summary.length&&description)summary.push(clean(description).split(/\s+/).slice(0,90).join(' '));
 return {title:clean(title),url,summary,paragraphs,limited,truncated,print_url,word_count:paragraphs.join(' ').split(/\s+/).filter(Boolean).length};
}
