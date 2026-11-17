'use client';
import {useEffect,useState} from 'react';
import ArticlePreview from './ArticlePreview';
import type {Article,Story} from '@/lib/stories';
type Flash=Article&{breaking:boolean};
export default function FlashBar(){
 const [selected,setSelected]=useState<Story|null>(null);
 const [items,setItems]=useState<Flash[]>([]);const [index,setIndex]=useState(0);const [paused,setPaused]=useState(false);const [hovered,setHovered]=useState(false);const [error,setError]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  async function update(){try{const response=await fetch('/api/flashes',{signal:controller.signal});if(!response.ok)throw new Error();const result=await response.json();if(!controller.signal.aborted){setItems(previous=>{const next:Flash[]=result.data;return previous.length&&JSON.stringify(previous)===JSON.stringify(next)?previous:next;});setError(false);}}catch{if(!controller.signal.aborted)setError(true);}}
  update();const refresh=setInterval(update,30000);return()=>{controller.abort();clearInterval(refresh);};
 },[]);
 useEffect(()=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)setPaused(true);},[]);
 useEffect(()=>{if(paused||hovered||items.length<2)return;const rotate=setInterval(()=>setIndex(i=>(i+1)%items.length),8000);return()=>clearInterval(rotate);},[paused,hovered,items.length]);
 const current=items[index%Math.max(items.length,1)];
 const story:Story|undefined=current?{...current,id:current.url,summary:current.description||current.title,summary_parts:[],coverage:[current],source_count:1,image_source:null,image_article_url:null,image_published_at:null}:undefined;
 return <section aria-label="מבזקי חדשות" className="border-b border-red-400/20 bg-[#291c28] px-3 py-2 sm:px-6" onPointerEnter={()=>setHovered(true)} onPointerLeave={()=>setHovered(false)} onFocusCapture={()=>setHovered(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setHovered(false);}}>
  <div className="mx-auto flex max-w-7xl items-center gap-2 sm:gap-4">
   <span className="shrink-0 rounded-md bg-red-500/20 px-2 py-2 text-xs font-bold text-red-200 sm:px-3 sm:text-sm">{current?.breaking?'חדשות מתפרצות':'מבזקים'}</span>
   <div className="min-w-0 flex-1">{story?<ArticlePreview story={selected||story} hoverPreview={false}>{open=><button onClick={()=>{setSelected(story);setPaused(true);open();}} className="flex min-h-12 w-full flex-col justify-center text-right"><span className="line-clamp-2 text-sm font-semibold leading-6 text-white sm:line-clamp-1 sm:text-base">{story.title}</span><span className="text-[11px] leading-4 text-gray-400">ynet · {new Date(story.published_at!).toLocaleTimeString('he-IL',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit'})}</span></button>}</ArticlePreview>:<p className="py-2 text-sm text-gray-400" role="status">{error?'המבזקים אינם זמינים כרגע':'טוען מבזקים…'}</p>}</div>
   {items.length>1&&<div className="flex shrink-0 gap-1"><button onClick={()=>{setSelected(null);setPaused(!paused);}} aria-label={paused?'הפעלת סבב המבזקים':'השהיית סבב המבזקים'} aria-pressed={paused} className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/15 text-sm text-gray-200">{paused?'▶':'Ⅱ'}</button><button onClick={()=>{setSelected(null);setIndex(i=>(i+1)%items.length);}} aria-label="המבזק הבא" className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/15 text-xl text-gray-200">‹</button></div>}
  </div>
 </section>;
}
