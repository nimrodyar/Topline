import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildStories} from '../src/lib/stories.ts';
const article=(source,title,extra={})=>({source,title,url:`https://${source}.example/${encodeURIComponent(title)}`,image_url:`https://images.example/${source}.jpg`,published_at:'2026-11-17T12:00:00Z',category:'politics',type:'rss',description:'דיווח חדש על תוצאות הבדיקה שהתפרסמו היום לציבור. גורמי המקצוע מסרו כי הבדיקה נמשכת.',...extra});
const first=article('ynet','סולברג וזיני הודיעו: אין ראיות לשוחד בבחירות לכנסת');
const second=article('walla','סולברג וזיני: אין ראיות לתשלום שוחד בבחירות',{published_at:'2026-11-17T13:00:00Z'});
test('combines one event from independent publishers and credits newest image',()=>{
 const [story]=buildStories([first,second]);
 assert.equal(story.source_count,2);assert.equal(story.coverage.length,2);
 assert.equal(story.image_url,second.image_url);assert.equal(story.image_article_url,second.url);
 assert.equal(story.image_published_at,second.published_at);
 assert.deepEqual(new Set(story.summary_parts.map(p=>p.source)),new Set(['ynet','walla']));
 for(const part of story.summary_parts) assert(part.text.split(' ').length<=22);
});
test('does not combine unrelated stories mentioning the same people',()=>{
 const other=article('haaretz','סולברג וזיני נפגשו לדון באבטחת בתי המשפט');
 assert.equal(buildStories([first,other]).length,2);
});
test('does not count mako and N12 as two independent publishers',()=>{
 const result=buildStories([{...first,source:'mako'},{...second,source:'n12'}]);
 assert.equal(result[0].source_count,1);
});
test('does not substitute an older image when newest report has none',()=>{
 const result=buildStories([first,{...second,image_url:null}]);
 assert.equal(result[0].image_url,null);assert.equal(result[0].image_article_url,null);
});
test('does not merge undated or different-day reports',()=>{
 assert.equal(buildStories([first,{...second,published_at:null}]).length,2);
 assert.equal(buildStories([first,{...second,published_at:'2026-11-15T12:00:00Z'}]).length,2);
});
test('limits a combined summary to three independent publishers',()=>{
 const result=buildStories(['ynet','walla','haaretz','n12'].map(source=>({...first,source,url:`https://${source}.example/article`})));
 assert.equal(result[0].source_count,3);assert.equal(result[0].summary_parts.length,3);
});
