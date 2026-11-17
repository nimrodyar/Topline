export type Article = { title: string; url: string; source: string; image_url: string | null; published_at: string | null; category: string; type: string; description?: string };
export type Contribution = { text: string; source: string; url: string };
export type Story = Article & { id: string; summary: string; summary_parts: Contribution[]; coverage: Article[]; source_count: number; image_source: string | null; image_article_url: string | null; image_published_at: string | null };
const stopwords = new Set('של את על עם אל עד כי גם לא הוא היא הם הן זה זאת היה היו יש אין עוד כל אחרי לפני כבר יותר נגד בין מתוך אשר אבל לפי היום כעת בעקבות לקראת ישראל ישראלי ישראלית ארהב נתניהו דיווח ראשון חשיפה פרסום חדשות עדכון צפו עכשיו שידור ישיר'.split(' '));
export const publisher = (source: string) => ['mako','n12'].includes(source) ? 'keshet' : source;
const time = (article: Article) => Date.parse(article.published_at || '') || 0;
function tokens(value: string) {
  return Array.from(new Set(value.toLowerCase().replace(/[\u0591-\u05c7]/g,'').replace(/["'״׳]/g,'').split(/[^a-z0-9א-ת]+/).filter(word=>word.length>1 && !stopwords.has(word)).map(word=>word.length>=5 && /^[ובלהש]/.test(word) ? word.slice(1) : word).filter(word=>!stopwords.has(word))));
}
function clip(value: string, limit: number) {
  const words=value.replace(/\s+/g,' ').trim().split(' ');
  return words.length>limit ? words.slice(0,limit).join(' ').replace(/[,:;\-–]+$/,'')+'…' : words.join(' ');
}
function contribution(article: Article): Contribution {
  const clean=(article.description || '').replace(/\s+/g,' ').trim();
  const sentences=clean.split(/(?<=[.!?])\s+/).filter(part=>tokens(part).length>=5);
  let sentence=sentences.find(part=>part.split(' ').length<=22) || sentences[0] || clean || article.title;
  if(sentence.split(' ').length>22) {
    const clauses=sentence.split(/[,;]\s+/);let compact='';
    for(const clause of clauses) {const next=compact?compact+', '+clause:clause;if(next.split(' ').length>22) break;compact=next;}
    sentence=compact && tokens(compact).length>=5 ? compact.replace(/[.:;]+$/,'')+'.' : article.title;
  }
  return {text:clip(sentence,22),source:article.source,url:article.url};
}
export function buildStories(articles: Article[]): Story[] {
  const sorted=[...articles].sort((a,b)=>time(b)-time(a));
  const vocabulary=new Map<string,number>();
  const wordSets=new Map<Article,Set<string>>();
  for(const article of sorted) {
    const words=new Set(tokens(article.title));wordSets.set(article,words);
    for(const word of Array.from(words)) vocabulary.set(word,(vocabulary.get(word)||0)+1);
  }
  const weight=(word:string)=>Math.log(1+sorted.length/(vocabulary.get(word)||1));
  function related(a:Article,b:Article) {
    if(a.url===b.url) return true;
    // Undated headlines cannot establish that two publishers cover the same event.
    if(!time(a)||!time(b)||Math.abs(time(a)-time(b))>18*3600000) return false;
    const aw=wordSets.get(a)!;const bw=wordSets.get(b)!;
    const shared=Array.from(aw).filter(word=>bw.has(word));
    if(shared.length<3) return false;
    const dot=shared.reduce((sum,word)=>sum+weight(word)**2,0);
    const norm=(words:Set<string>)=>Math.sqrt(Array.from(words).reduce((sum,word)=>sum+weight(word)**2,0));
    const cosine=dot/(norm(aw)*norm(bw)||1);
    return cosine>=0.43 && shared.length/Math.min(aw.size,bw.size)>=0.4;
  }
  const groups:Article[][]=[];
  for(const article of sorted) {
    // Compare with the seed, never transitively join different events through a broad headline.
    const group=groups.find(items=>related(items[0],article));
    if(group) group.push(article);else groups.push([article]);
  }
  return groups.map(group=>{
    const latest=group[0];
    const families=new Set<string>();
    const coverage=group.filter(article=>{
      const family=publisher(article.source);
      if(families.has(family)) return false;
      families.add(family);return true;
    }).slice(0,3);
    // Concise, attributed extracts preserve differences between reports rather than inventing consensus.
    const summary_parts=coverage.map(contribution);
    return {...latest,id:latest.url,summary:summary_parts.map(part=>part.text).join(' '),summary_parts,coverage,source_count:coverage.length,
      image_url:latest.image_url,image_source:latest.image_url?latest.source:null,image_article_url:latest.image_url?latest.url:null,image_published_at:latest.image_url?latest.published_at:null};
  }).sort((a,b)=>(Number(b.source_count>1)-Number(a.source_count>1)) || time(b)-time(a));
}
