import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseArticle,publisherUrl} from '../src/lib/article-reader.ts';
const url='https://www.ynet.co.il/news/article/example';
const paragraphs=['פסקה ראשונה של כתבה ציבורית הכוללת מידע מפורט ועדכני על האירוע שהתרחש היום בעיר.','פסקה שנייה של כתבה ציבורית עם מידע נוסף שנמסר על ידי הגורמים המקצועיים במהלך היום.','פסקה שלישית המסכמת את הפרטים שהיו זמינים לציבור בזמן פרסום הכתבה באתר המקור.'];
test('extracts public article paragraphs and keeps navigation out',()=>{
 const html='<h1>כתבה לבדיקה</h1><nav><p>טקסט ניווט ארוך שלא צריך להופיע בתוכן הכתבה בכלל</p></nav><article>'+paragraphs.map(p=>'<p>'+p+'</p>').join('')+'</article>';
 const result=parseArticle(html,url);assert.equal(result.limited,false);assert.deepEqual(result.paragraphs,paragraphs);assert(result.summary.length>0);
});
test('does not expose restricted JSON-LD article bodies',()=>{
 const html='<meta name="description" content="תיאור ציבורי קצר בלבד"><script type="application/ld+json">'+JSON.stringify({'@type':'NewsArticle',isAccessibleForFree:false,articleBody:paragraphs.join('\n')})+'</script>';
 const result=parseArticle(html,url);assert.equal(result.limited,true);assert.deepEqual(result.paragraphs,[]);assert(!result.summary.join(' ').includes(paragraphs[0]));
});
test('retains publisher-provided PDF links without inventing print URLs',()=>{
 const result=parseArticle('<a href="/news/article/example.pdf" type="application/pdf">PDF</a>',url);
 assert.equal(result.print_url,url+'.pdf');assert.equal(parseArticle('<h1>כתבה</h1>',url).print_url,null);
});
test('rejects external hosts, credentials, HTTP and private IP addresses',()=>{
 for(const target of ['http://www.ynet.co.il/news/article/a','https://127.0.0.1/article/a','https://www.ynet.co.il.evil.example/article/a','https://user:pass@www.ynet.co.il/article/a'])assert.equal(publisherUrl(target),null);
 assert.equal(publisherUrl(url),url);
});
