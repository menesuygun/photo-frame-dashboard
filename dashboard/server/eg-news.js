// Official municipal news only. Excerpts are taken from the Town's published summaries.
import {createHash} from 'node:crypto';
export const source='https://www.eastgwillimbury.ca/Modules/News/en';
let cached=null,pending=null,retryAfter=0;
const ttl=15*60000;
function text(html){
 const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',ndash:'–',mdash:'—',hellip:'…'};
 return String(html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(all,key)=>{
  if(key[0]!=='#')return entities[key.toLowerCase()]??all;
  const code=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
  return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';
 }).replace(/\s+/g,' ').trim();
}
function published(value){const m=value.match(/([A-Z][a-z]+) (\d{1,2}), (\d{4})/);if(!m)return null;const months=['January','February','March','April','May','June','July','August','September','October','November','December'],month=months.indexOf(m[1])+1;return month?m[3]+'-'+String(month).padStart(2,'0')+'-'+m[2].padStart(2,'0'):null;}
function summarize(html){
 const clean=text(html);if(!clean)return '';
 const sentences=[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(clean)].map(part=>part.segment.trim()).filter(Boolean);
 // Keep one or two complete opening sentences, avoiding a long second sentence on a glanceable card.
 let result=sentences[0]||clean;
 if(sentences[1]&&result.length+sentences[1].length<150)result+=' '+sentences[1];
 return result.slice(0,600);
}
export function parseNews(html){
 const articles=[];
 for(const block of html.split(/<div\s+class="blogItem\s*[^"]*"\s*>/i).slice(1)){
  const heading=block.match(/<h2>\s*<a\b([^>]*class="newsTitle"[^>]*)>([\s\S]*?)<\/a>\s*<\/h2>/i);
  if(!heading)continue;
  const href=heading[1].match(/\bhref=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);if(!href)continue;
  let url;try{url=new URL(text(href[1]||href[2]||href[3]),source);if(url.protocol!=='https:'||url.hostname!=='www.eastgwillimbury.ca'||!url.pathname.startsWith('/en/news/'))continue;}catch{continue;}
  const content=block.slice(block.indexOf('</h2>')+5);
  const dateBlock=content.match(/<div\s+class="blogPostDate"[^>]*>([\s\S]*?)<\/div>/i);if(!dateBlock)continue;
  const summaryHtml=content.slice(content.indexOf(dateBlock[0])+dateBlock[0].length).split(/<div\s+class="readmoreWrapper"/i)[0];
  const summary=summarize(summaryHtml),title=text(heading[2]);
  if(!title||!summary)continue;
  articles.push({id:createHash('sha256').update(url.href).digest('hex').slice(0,16),title:title.slice(0,220),summary,url:url.href,published:published(text(dateBlock[1])),source:'Town of East Gwillimbury'});
 }
 return articles;
}
export async function townNews(){
 if(cached&&Date.now()-cached.fetched<ttl)return {...cached,stale:false};
 if(cached&&Date.now()<retryAfter)return {...cached,stale:true};
 if(pending)return pending;
 pending=(async()=>{
  try{
   const pages=await Promise.all([source,source+'?page=2'].map(async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'text/html'}});if(!r.ok)throw Error('Town news unavailable');const html=await r.text();if(html.length>2000000)throw Error('Town page too large');return parseNews(html);}));
   const articles=[...new Map(pages.flat().map(item=>[item.url,item])).values()].slice(0,10);
   if(!articles.length)throw Error('Town news format changed');
   cached={articles,fetched:Date.now()};return {...cached,stale:false};
  }catch{retryAfter=Date.now()+60000;if(cached)return {...cached,stale:true};throw Error('Town news temporarily unavailable');}
  finally{pending=null;}
 })();return pending;
}
