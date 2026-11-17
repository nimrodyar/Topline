'use client';

import { useEffect, useRef, useState } from 'react';

type Article = { title: string; url: string; source: string; image_url: string | null; published_at: string | null; category: string; type: string };
type Source = { source: string; status: string; count: number };
type Feed = { data: Article[]; has_more: boolean; fetched_at: string; sources: Source[] };
const categories = [['all','הכל'],['politics','פוליטיקה'],['business','עסקים'],['technology','טכנולוגיה'],['sports','ספורט'],['entertainment','בידור'],['health','בריאות'],['science','מדע']];
const names: Record<string,string> = {ynet:'ynet',walla:'וואלה',mako:'mako',haaretz:'הארץ',n12:'N12'};

function timestamp(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'זמן הפרסום לא זמין';
  return new Date(value).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function NewsCard({item}:{item:Article}) {
  const [failed,setFailed] = useState(false);
  return <a href={item.url} target="_blank" rel="noopener noreferrer" className="group relative flex min-h-72 flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-[#232d3e] shadow-lg transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
    {item.image_url && !failed && <img src={item.image_url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(true)} className="absolute inset-0 h-full w-full object-cover opacity-40 transition-opacity group-hover:opacity-60" />}
    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
    <div className="relative p-6">
      <span className="mb-3 inline-block text-sm font-semibold text-accent">{names[item.source] || item.source}</span>
      <h2 className="text-xl font-bold leading-relaxed text-white">{item.title}</h2>
      <p className="mt-4 text-xs text-gray-300">{timestamp(item.published_at)}</p>
      <span className="mt-3 inline-block text-sm text-white underline underline-offset-4">לכתבה במקור ←</span>
    </div>
  </a>;
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
        if (!controller.signal.aborted) {setUpdates(result.data.slice(0,8));setUpdatesError('');}
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
  return <main className="min-h-screen bg-bg text-text">
    <header className="sticky top-0 z-30 border-b border-accent/30 bg-bg/95 px-4 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3">
        <img src="/logo.png" alt="10TEN — חדשות ישראל" className="h-16 w-auto" />
        <h1 className="text-sm text-gray-300">כל הכותרות, ישירות מהמקור</h1>
        <nav aria-label="קטגוריות חדשות" className="flex flex-wrap justify-center gap-2">
          {categories.map(([key,label])=><button key={key} onClick={()=>setCategory(key)} aria-pressed={key===category} className={`rounded-full border border-accent/40 px-3 py-1.5 text-sm transition-colors hover:bg-accent/20 ${key===category?'bg-accent text-bg':'text-accent'}`}>{label}</button>)}
        </nav>
      </div>
    </header>
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400" aria-live="polite">
        <span>{feed ? `עדכון אחרון: ${timestamp(feed.fetched_at)} · מקורות זמינים: ${activeSources.map(s=>names[s]||s).join(', ')}` : 'טוען כותרות מהמקורות…'}</span>
        <button onClick={()=>setRefresh(value=>value+1)} className="rounded-full border border-accent/40 px-4 py-2 text-accent">רענון חדשות</button>
      </div>
      {error && <div role="alert" className="mb-6 rounded-xl border border-orange-400/40 p-4 text-orange-200">{error}{feed && ' · הכותרות האחרונות נשארות זמינות.'}</div>}
      {loading ? <div role="status" aria-label="טוען חדשות" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({length:8},(_,i)=><div key={i} className="min-h-72 animate-pulse rounded-2xl bg-white/10" />)}</div>
        : feed?.data.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{feed.data.map(item=><NewsCard key={item.url} item={item} />)}</div>
        : !error && <p className="py-16 text-center text-gray-300">אין כותרות זמינות בקטגוריה זו כרגע.</p>}
      {feed?.has_more && <div className="mt-8 text-center"><button disabled={moreLoading} onClick={loadMore} className="rounded-full bg-accent px-8 py-3 font-semibold text-bg disabled:opacity-50">{moreLoading?'טוען…':'כותרות נוספות'}</button></div>}
      <footer className="mt-12 border-t border-white/10 py-6 text-center text-xs leading-6 text-gray-400">10TEN מרכז כותרות וקישורים ממקורות חדשות. הכתבות והתמונות שייכות למפרסמים המקוריים.<br/>הכותרות מתעדכנות אוטומטית בכל שתי דקות בזמן שהעמוד פתוח. זמינות התוכן תלויה במקורות.</footer>
    </div>
    <button onClick={()=>setUpdatesOpen(!updatesOpen)} aria-expanded={updatesOpen} aria-controls="quick-updates" className="fixed bottom-5 left-5 z-40 rounded-full bg-accent px-5 py-3 font-bold text-bg shadow-xl">{updatesOpen?'סגירה':'עדכונים מהירים'}</button>
    {updatesOpen && <aside id="quick-updates" aria-label="עדכונים מהירים" className="fixed bottom-20 left-4 z-40 max-h-[65vh] w-[calc(100%-2rem)] max-w-sm overflow-auto rounded-2xl border border-accent/30 bg-bg p-5 shadow-2xl">
      <h2 className="mb-3 text-xl font-bold">עדכונים מהירים</h2>
      <div className="mb-4 flex gap-2">{[['general','כללי'],['sports','ספורט']].map(([key,label])=><button key={key} aria-pressed={updateCategory===key} onClick={()=>setUpdateCategory(key)} className={`rounded-full border border-accent/40 px-4 py-1 ${updateCategory===key?'bg-accent text-bg':'text-accent'}`}>{label}</button>)}</div>
      {updatesError && <p role="alert">{updatesError}</p>}
      {!updates.length && !updatesError && <p>אין עדכונים זמינים כרגע.</p>}
      {updates.map(item=><a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="block border-b border-white/10 py-3 hover:text-accent"><p className="text-xs text-accent">{names[item.source]||item.source} · {timestamp(item.published_at)}</p><p className="mt-1 text-sm leading-6">{item.title}</p></a>)}
    </aside>}
  </main>;
}
