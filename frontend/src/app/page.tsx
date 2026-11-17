'use client';

import { useEffect, useRef, useState } from 'react';

import type { Story as Article } from '@/lib/stories';
type Source = { source: string; status: string; count: number };
type Feed = { data: Article[]; has_more: boolean; fetched_at: string; sources: Source[]; multi_source_total: number };
const categories = [['all','הכל'],['politics','פוליטיקה'],['business','עסקים'],['technology','טכנולוגיה'],['sports','ספורט'],['entertainment','בידור'],['health','בריאות'],['science','מדע']];
const names: Record<string,string> = {ynet:'ynet',walla:'וואלה',mako:'mako',haaretz:'הארץ',n12:'N12'};

function timestamp(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'זמן הפרסום לא זמין';
  return new Date(value).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function NewsCard({item}:{item:Article}) {
  const [failed,setFailed] = useState(false);
  useEffect(()=>setFailed(false),[item.image_url]);
  return <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#202a39] shadow-lg">
    <a href={item.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true" className="relative block aspect-video overflow-hidden bg-[#283649]">
      {item.image_url && !failed ? <img src={item.image_url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(true)} className="h-full w-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">תמונה לא זמינה מהדיווח האחרון</span>}
    </a>
    <div className="flex flex-1 flex-col p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className={item.source_count>1?'rounded-full bg-accent/15 px-3 py-1.5 font-semibold text-accent':'text-gray-400'}>{item.source_count>1?`סיקור מ־${item.source_count} מקורות`:'דיווח ממקור אחד'}</span>
        <time dateTime={item.published_at || undefined} className="text-gray-400">{timestamp(item.published_at)}</time>
      </div>
      <h2 className="text-xl font-bold leading-relaxed text-white"><a href={item.url} target="_blank" rel="noopener noreferrer" className="rounded hover:text-accent">{item.title}</a></h2>
      <div className="mt-4 space-y-3 text-base leading-7 text-gray-200">
        {item.summary_parts?.filter(part=>part.text.replace(/[….,]/g,'')!==item.title.replace(/[….,]/g,'')).map(part=><p key={part.url}>{part.text} <a href={part.url} target="_blank" rel="noopener noreferrer" className="inline-block rounded px-1 text-sm text-accent underline decoration-accent/40 underline-offset-4" aria-label={`הדיווח של ${names[part.source]||part.source}`}>({names[part.source]||part.source})</a></p>)}
      </div>
      <div className="mt-auto pt-5">
        <p className="mb-1 text-xs text-gray-400">{item.source_count>1?'לכל הדיווחים במקור':'לכתבה במקור'}</p>
        <div className="flex flex-wrap gap-2">{(item.coverage || [item]).map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-accent/30 px-4 text-sm font-semibold text-accent hover:bg-accent/10">{names[source.source]||source.source} ↗</a>)}</div>
        {item.image_source && !failed && <p className="mt-3 text-xs leading-5 text-gray-400">תמונה מהדיווח האחרון: <a href={item.image_article_url || item.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{names[item.image_source]||item.image_source}</a> · {timestamp(item.image_published_at)}</p>}
      </div>
    </div>
  </article>;
}
export default function Home() {
  const [category,setCategory] = useState('all');
  const [feed,setFeed] = useState<Feed | null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [page,setPage] = useState(1);
  const [moreLoading,setMoreLoading] = useState(false);
  const [updatesOpen,setUpdatesOpen] = useState(false);
  const [updates,setUpdates] = useState<Article[]>([]);
  const [updateCategory,setUpdateCategory] = useState('general');
  const [updatesError,setUpdatesError] = useState('');
  const [refresh,setRefresh] = useState(0);
  const generation = useRef(0);
  const updatesDialog = useRef<HTMLDialogElement>(null);
  const updatesButton = useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const dialog=updatesDialog.current;
    if(!dialog) return;
    if(updatesOpen && !dialog.open) dialog.showModal();
    if(!updatesOpen && dialog.open) {dialog.close();updatesButton.current?.focus();}
  },[updatesOpen]);

  useEffect(()=>{
    const controller = new AbortController();
    generation.current++; setLoading(true); setError(''); setFeed(null); setPage(1);
    async function fetchFeed(initial:boolean) {
      try {
        const response = await fetch(`/api/news?category=${category}&page=1`,{signal:controller.signal});
        if (!response.ok) throw new Error('החדשות אינן זמינות כרגע. אפשר לנסות שוב.');
        const result: Feed = await response.json();
        if (!Array.isArray(result.data)) throw new Error('שגיאה בתשובת השרת');
        if (!controller.signal.aborted) { setFeed(result); setPage(1); setError(''); }
      } catch(e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'שגיאה בטעינת חדשות');
      } finally { if (initial && !controller.signal.aborted) setLoading(false); }
    }
    fetchFeed(true);
    const interval = setInterval(()=>fetchFeed(false),120000);
    return ()=>{controller.abort();clearInterval(interval);};
  },[category,refresh]);

  useEffect(()=>{
    const controller = new AbortController();
    async function fetchUpdates() {
      try {
        const response = await fetch(`/api/news?category=${updateCategory}`,{signal:controller.signal});
        if (!response.ok) throw new Error('העדכונים אינם זמינים כרגע');
        const result:Feed = await response.json();
        if (!controller.signal.aborted) {setUpdates([...result.data].sort((a,b)=>(Date.parse(b.published_at || '')||0)-(Date.parse(a.published_at || '')||0)).slice(0,8));setUpdatesError('');}
      } catch {if(!controller.signal.aborted) setUpdatesError('העדכונים אינם זמינים כרגע');}
    }
    setUpdates([]);fetchUpdates();const interval=setInterval(fetchUpdates,120000);
    return ()=>{controller.abort();clearInterval(interval);};
  },[updateCategory,refresh]);

  async function loadMore() {
    if (moreLoading || !feed?.has_more) return;
    const current = generation.current;setMoreLoading(true);
    try {
      const response=await fetch(`/api/news?category=${category}&page=${page+1}`);
      if(!response.ok) throw new Error('לא ניתן לטעון כתבות נוספות כרגע');
      const result:Feed=await response.json();
      if(current!==generation.current) return;
      setFeed(previous=>previous ? {...result,data:[...previous.data,...result.data.filter(item=>!previous.data.some(existing=>existing.url===item.url))]} : result);
      setPage(page+1);
    } catch(e) {if(current===generation.current) setError(e instanceof Error ? e.message : 'שגיאה בטעינת חדשות');}
    finally {setMoreLoading(false);}
  }
  const activeSources=Array.from(new Set(feed?.sources.filter(s=>s.status==='ok').map(s=>s.source) || []));
  return <main className="min-h-screen bg-bg text-text pb-20 sm:pb-0">
    <a href="#news-feed" className="sr-only focus:not-sr-only focus:fixed focus:right-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:p-3 focus:text-bg">דילוג לחדשות</a>
    <header className="sticky top-0 z-30 border-b border-accent/30 bg-bg/95 px-3 py-2.5 backdrop-blur sm:px-4 sm:py-4">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 sm:gap-3">
        <img src="/logo.png" alt="10TEN — חדשות ישראל" width="124" height="64" className="h-10 w-auto sm:h-14" />
        <h1 className="text-sm text-gray-300">תקציר אחד, כמה מקורות</h1>
        <nav aria-label="קטגוריות חדשות" className="category-scroll flex w-full flex-nowrap gap-2 overflow-x-auto pb-1 sm:justify-center">
          {categories.map(([key,label])=><button key={key} onClick={()=>setCategory(key)} aria-pressed={key===category} className={`min-h-11 shrink-0 rounded-full border border-accent/40 px-4 py-2 text-sm transition-colors hover:bg-accent/20 ${key===category?'bg-accent text-bg':'text-accent'}`}>{label}</button>)}
        </nav>
      </div>
    </header>
    <div id="news-feed" className="mx-auto max-w-7xl scroll-mt-40 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400" aria-live="polite">
        <span>{feed ? `עדכון אחרון: ${timestamp(feed.fetched_at)} · מקורות זמינים: ${activeSources.map(s=>names[s]||s).join(', ')}` : 'טוען כותרות מהמקורות…'}</span>
        <button onClick={()=>setRefresh(value=>value+1)} className="min-h-11 shrink-0 rounded-full border border-accent/40 px-4 py-2 text-accent">רענון חדשות</button>
      </div>
      {error && <div role="alert" className="mb-6 rounded-xl border border-orange-400/40 p-4 text-orange-200">{error}{feed && ' · הכותרות האחרונות נשארות זמינות.'}</div>}
      {loading ? <div role="status" aria-label="טוען חדשות" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{Array.from({length:8},(_,i)=><div key={i} className="min-h-72 animate-pulse rounded-2xl bg-white/10" />)}</div>
        : feed?.data.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{feed.data.map(item=><NewsCard key={item.url} item={item} />)}</div>
        : !error && <p className="py-16 text-center text-gray-300">אין כותרות זמינות בקטגוריה זו כרגע.</p>}
      {feed?.has_more && <div className="mt-8 text-center"><button disabled={moreLoading} onClick={loadMore} className="rounded-full bg-accent px-8 py-3 font-semibold text-bg disabled:opacity-50">{moreLoading?'טוען…':'כותרות נוספות'}</button></div>}
      <footer className="mt-12 border-t border-white/10 py-6 text-center text-xs leading-6 text-gray-400">10TEN מרכז תמציות קצרות וקישורים לדיווחים המקוריים. סיקור משולב מופיע כשיש התאמה בין 2–3 גופי תקשורת שונים. הכתבות והתמונות שייכות למפרסמים המקוריים.<br/>הכותרות מתעדכנות אוטומטית בכל שתי דקות בזמן שהעמוד פתוח. זמינות התוכן תלויה במקורות.</footer>
    </div>
    <button ref={updatesButton} onClick={()=>setUpdatesOpen(true)} aria-haspopup="dialog" aria-expanded={updatesOpen} aria-controls="quick-updates" className="quick-updates-trigger fixed bottom-4 left-4 z-40 min-h-12 rounded-full bg-accent px-5 py-3 font-bold text-bg shadow-xl">עדכונים מהירים</button>
    <dialog ref={updatesDialog} id="quick-updates" aria-labelledby="updates-title" onCancel={()=>setUpdatesOpen(false)} onClose={()=>setUpdatesOpen(false)} className="updates-dialog fixed inset-x-0 bottom-0 top-auto m-0 max-h-[80dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-3xl border border-accent/30 bg-bg p-5 text-text shadow-2xl sm:bottom-5 sm:left-5 sm:right-auto sm:w-96 sm:rounded-2xl">
      <div className="mb-3 flex items-center justify-between gap-3"><h2 id="updates-title" className="text-xl font-bold">עדכונים מהירים</h2><button onClick={()=>setUpdatesOpen(false)} aria-label="סגירת עדכונים מהירים" className="min-h-11 min-w-11 rounded-full border border-white/20 text-xl">×</button></div>
      <div className="mb-4 flex gap-2">{[['general','כללי'],['sports','ספורט']].map(([key,label])=><button key={key} aria-pressed={updateCategory===key} onClick={()=>setUpdateCategory(key)} className={`min-h-11 rounded-full border border-accent/40 px-4 py-2 ${updateCategory===key?'bg-accent text-bg':'text-accent'}`}>{label}</button>)}</div>
      {updatesError && <p role="alert">{updatesError}</p>}
      {!updates.length && !updatesError && <p>אין עדכונים זמינים כרגע.</p>}
      {updates.map(item=><a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="block border-b border-white/10 py-3 hover:text-accent"><p className="text-xs text-accent">{names[item.source]||item.source} · {timestamp(item.published_at)}</p><p className="mt-1 text-sm leading-6">{item.title}</p></a>)}
    </dialog>
  </main>;
}
