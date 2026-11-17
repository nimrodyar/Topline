'use client';
import {ReactNode,useEffect,useRef,useState} from 'react';
import type {Story} from '@/lib/stories';
import type {ReaderContent} from '@/lib/article-reader';
const cache=new Map<string,{expires:number;promise:Promise<ReaderContent>}>();
function read(url:string){
 const stored=cache.get(url);if(stored&&stored.expires>Date.now())return stored.promise;
 const promise=fetch('/api/article?url='+encodeURIComponent(url),{signal:AbortSignal.timeout(18000)}).then(async response=>{if(!response.ok)throw new Error('לא ניתן לטעון את הכתבה כרגע');return response.json() as Promise<ReaderContent>;}).catch(error=>{cache.delete(url);throw error;});
 if(cache.size>=40)cache.delete(cache.keys().next().value!);
 cache.set(url,{expires:Date.now()+300000,promise});return promise;
}
export default function ArticlePreview({story,children,hoverPreview=true}:{story:Story;children:(open:()=>void)=>ReactNode;hoverPreview?:boolean}) {
 const [hover,setHover]=useState(false);const [open,setOpen]=useState(false);const [content,setContent]=useState<ReaderContent|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const dialog=useRef<HTMLDialogElement>(null);const returnFocus=useRef<HTMLElement|null>(null);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 useEffect(()=>{if(!hover&&!open)return;let active=true;setContent(null);setLoading(true);setError('');(async()=>{
  let primary:ReaderContent|null=null;
  try{primary=await read(story.url);}catch{}
  if(primary&&!primary.limited&&primary.paragraphs.length)return primary;
  const alternatives=await Promise.allSettled((story.coverage||[]).filter(item=>item.url!==story.url).slice(0,2).map(item=>read(item.url)));
  const available=alternatives.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
  const publicReport=available.find(item=>!item.limited&&item.paragraphs.length);
  if(publicReport)return publicReport;
  if(primary)return primary;if(available[0])return available[0];throw new Error('No public article');
 })().then(result=>{if(active)setContent(result);}).catch(()=>{if(active)setError('המקור אינו זמין כרגע. אפשר לקרוא באתר המקור.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[hover,open,story.url]);
 useEffect(()=>{const d=dialog.current;if(!d)return;if(open&&!d.open)d.showModal();if(!open&&d.open){d.close();returnFocus.current?.focus();}},[open]);
 function show(){returnFocus.current=document.activeElement as HTMLElement;setHover(false);setOpen(true);}
 const fallback=story.summary_parts?.length?story.summary_parts.map(part=>part.text):[(story.description||story.title).split(/\s+/).slice(0,70).join(' ')];
 const summary=content?.summary.length?content.summary:fallback;
 const readingSource=story.coverage?.find(item=>item.url===content?.url)?.source||story.source;
 return <div className="relative min-w-0" onPointerEnter={event=>{if(hoverPreview&&event.pointerType==='mouse'&&window.matchMedia('(hover:hover) and (pointer:fine)').matches)timer.current=setTimeout(()=>setHover(true),650);}} onPointerLeave={()=>{if(timer.current)clearTimeout(timer.current);setHover(false);}}>
  {children(show)}
  {hover&&!open&&<section aria-label="תצוגה מקדימה של הכתבה" className="absolute inset-0 z-20 hidden overflow-auto rounded-2xl border border-accent/50 bg-[#182230]/95 p-6 shadow-2xl md:block">
   <div className="mb-4 flex items-center justify-between gap-3"><span className="text-sm font-bold text-accent">תקציר הכתבה</span><button aria-label="סגירת תצוגה מקדימה" onClick={()=>setHover(false)} className="min-h-11 min-w-11 rounded-full border border-white/20">×</button></div>
   <h3 className="mb-4 text-xl font-bold leading-relaxed">{story.title}</h3>
   {loading&&<p role="status" className="text-sm text-accent">טוען את הכתבה…</p>}
   <div className="space-y-3 leading-7 text-gray-200">{summary.map((p,i)=><p key={i}>{p}</p>)}</div>
   {error&&<p className="mt-3 text-sm text-gray-400">{error}</p>}
   <button onClick={show} className="mt-5 min-h-12 w-full rounded-full bg-accent px-5 py-3 font-bold text-bg">פתיחת הכתבה לקריאה</button>
   <a href={story.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center text-accent underline">לכתבה באתר המקור ↗</a>
   {!!content?.paragraphs.length&&<section className="mt-5 border-t border-white/15 pt-5"><h4 className="mb-3 font-bold text-accent">תוכן הכתבה</h4><div className="space-y-4 text-base leading-8 text-gray-200">{content.paragraphs.map((p,i)=><p key={i}>{p}</p>)}</div></section>}
   {content?.print_url&&<a href={content.print_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center text-accent underline">גרסת הדפסה / PDF באתר המקור ↗</a>}
  </section>}
  <dialog ref={dialog} aria-label="קריאת הכתבה" onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)} className="reader-dialog fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl border border-accent/30 bg-[#182230] p-0 text-text shadow-2xl sm:inset-0 sm:m-auto sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-2xl">
   <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[#182230]/95 px-5 py-3 backdrop-blur"><span className="text-sm font-bold text-accent">קריאה נוחה · {readingSource}</span><button onClick={()=>setOpen(false)} aria-label="סגירת הכתבה" className="min-h-11 min-w-11 rounded-full border border-white/20 text-xl">×</button></div>
   <div className="p-5 sm:p-8"><h2 className="text-2xl font-bold leading-relaxed">{content?.title||story.title}</h2>
    <a href={content?.url||story.url} target="_blank" rel="noopener noreferrer" className="my-3 inline-flex min-h-11 items-center text-sm text-accent underline underline-offset-4">הדיווח המקורי ↗</a>
    {content&&content.url!==story.url&&<p className="my-3 text-sm leading-7 text-accent">הקריאה מוצגת מהדיווח הזמין של {readingSource} על אותו סיפור.</p>}
    {loading&&<p role="status" className="my-4 text-accent">טוען תוכן מהמקור…</p>}
    <section className="my-5 rounded-xl border border-accent/20 bg-accent/5 p-4"><h3 className="mb-3 font-bold text-accent">תקציר</h3><div className="space-y-3 text-base leading-8">{summary.map((p,i)=><p key={i}>{p}</p>)}</div></section>
    {error&&<p role="alert" className="my-5 text-orange-200">{error}</p>}
    {content?.limited&&<p className="my-5 rounded-xl border border-white/15 p-4 text-sm leading-7 text-gray-300">המקור מספק כאן תוכן חלקי בלבד. להמשך הקריאה יש לפתוח את הכתבה באתר המקור.</p>}
    {!!content?.paragraphs.length&&<section className="mt-7 border-t border-white/10 pt-6"><h3 className="mb-5 text-lg font-bold">{content.truncated?'תוכן זמין מהכתבה':'תוכן הכתבה'}</h3><div className="space-y-5 text-base leading-8 sm:text-lg sm:leading-9">{content.paragraphs.map((p,i)=><p key={i}>{p}</p>)}</div></section>}
    {content?.print_url&&<a href={content.print_url} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-12 items-center rounded-full border border-accent/40 px-5 text-accent">גרסת הדפסה / PDF באתר המקור ↗</a>}
    <p className="mt-8 border-t border-white/10 pt-5 text-xs leading-6 text-gray-400">הטקסט מובא מהמקור המקושר. זמינות התוכן תלויה במפרסם; תוכן מוגבל אינו נפתח כאן.</p>
   </div>
  </dialog>
 </div>;
}
