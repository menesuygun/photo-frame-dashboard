// Public EG town, police and local-news feeds. Summaries use published source text.
import {createHash} from 'node:crypto';
export const source='https://www.eastgwillimbury.ca/Modules/News/en';
let cached=null,pending=null,retryAfter=0;
const ttl=15*60000;
export function text(html){
 const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',ndash:'–',mdash:'—',hellip:'…'};
 return String(html||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(all,key)=>{
  if(key[0]!=='#')return entities[key.toLowerCase()]??all;
  const code=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
  return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';
 }).replace(/<[^>]*>/g,' ').replace(/\s+([,.!?;:])/g,'$1').replace(/\s+/g,' ').trim();
}
function published(value){const m=value.match(/([A-Z][a-z]+) (\d{1,2}), (\d{4})/);if(!m)return null;const months=['January','February','March','April','May','June','July','August','September','October','November','December'],month=months.indexOf(m[1])+1;return month?m[3]+'-'+String(month).padStart(2,'0')+'-'+m[2].padStart(2,'0'):null;}
export function summarize(html){
 const clean=text(html);if(!clean)return '';
 const sentences=[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(clean)].map(part=>part.segment.trim()).filter(sentence=>sentence&&!/^(?:view\b|read\b|learn more\b|visit\b|click\b|for more\b|to learn more\b|to view\b|for project updates\b)/i.test(sentence));
 let result=sentences[0]||clean;
 for(const sentence of sentences.slice(1,3)){if(result.length+sentence.length>800)break;result+=' '+sentence;}
 return result.slice(0,1200);
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
  articles.push({id:createHash('sha256').update(url.href).digest('hex').slice(0,16),title:title.slice(0,220),summary,url:url.href,published:published(text(dateBlock[1])),source:'Town of East Gwillimbury',kind:'town'});
 }
 return articles;
}
const relevant=value=>/east[\s-]*gwillimbury|holland landing|queensville|mount albert|sharon,? ontario/i.test(value);
const feeds=[
 {id:'town',url:source,format:'town'},
 {id:'town-more',url:source+'?page=2',format:'town'},
 {id:'yrp',url:'https://www.yrp.ca/media-releases/east-gwillimbury',format:'police'},
 {id:'yrp-latest',url:'https://www.yrp.ca/news-and-media/media-centre/media-releases',format:'police'},
 {id:'local',url:'https://www.newmarkettoday.ca/rss/local-news',format:'rss',kind:'local'},
 {id:'local-police',url:'https://www.newmarkettoday.ca/rss/police-beat',format:'rss',kind:'police'}
];
function article(title,summary,url,date,sourceName,kind,host){
 let link;try{link=new URL(url,host);if(link.protocol!=='https:'||link.hostname!==new URL(host).hostname)return null;}catch{return null;}
 if(!title||!summary||!relevant(title+' '+summary))return null;
 return {id:createHash('sha256').update(link.href).digest('hex').slice(0,16),title:title.slice(0,220),summary:summary.slice(0,1200),url:link.href,published:date,source:sourceName,kind};
}
export function parsePolice(html){
 const result=[];
 for(const block of html.split(/<div\s+class="views-row"[^>]*>/i).slice(1)){
  const heading=block.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i);
  const body=block.match(/<div\s+class="teaser-text"[^>]*>([\s\S]*)/i),date=block.match(/<span[^>]*class="teaser-date[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  if(!heading||!body)continue;
  const item=article(text(heading[2]),summarize(body[1].split(/<\/div>/i)[0]),heading[1],published(text(date?.[1])),'York Regional Police','police','https://www.yrp.ca');
  if(item)result.push(item);
 }
 return result;
}
export function parseLocalRSS(xml,kind){
 if(!/<rss\b/i.test(xml))throw Error('Local news feed unavailable');
 const field=(item,name)=>item.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'))?.[1]||'';
 return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(([,item])=>{
  const date=new Date(text(field(item,'pubDate'))),day=Number.isFinite(+date)?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(date):null;
  return article(text(field(item,'title')),summarize(field(item,'description')),text(field(item,'link')),day,'NewmarketToday',kind,'https://www.newmarkettoday.ca');
 }).filter(Boolean);
}
export async function townNews(){
 if(cached&&Date.now()-cached.fetched<ttl)return {...cached,stale:false};
 if(cached&&Date.now()<retryAfter)return {...cached,stale:true};
 if(pending)return pending;
 pending=(async()=>{
  try{
   const results=await Promise.allSettled(feeds.map(async feed=>{
    const r=await fetch(feed.url,{signal:AbortSignal.timeout(12000),headers:{Accept:feed.format==='rss'?'application/rss+xml, application/xml':'text/html'}});if(!r.ok)throw Error('Feed unavailable');
    const body=await r.text();if(body.length>2000000)throw Error('Feed too large');
    const items=feed.format==='town'?parseNews(body):feed.format==='police'?parsePolice(body):parseLocalRSS(body,feed.kind);
    if(!items.length&&feed.format!=='rss'&&!/views-row|blogItem/i.test(body))throw Error('Feed format changed');
    return items;
   }));
   const cutoff=Date.now()-90*86400000;
   let articles=[...new Map(results.flatMap(result=>result.status==='fulfilled'?result.value:[]).map(item=>[item.url,item])).values()].filter(item=>item.published&&Date.parse(item.published+'T12:00Z')>=cutoff);
   // Merge duplicate headlines carried by more than one public feed.
   const seen=new Set();articles=articles.sort((a,b)=>b.published.localeCompare(a.published)).filter(item=>{const key=item.title.toLowerCase().replace(/[^a-z0-9]/g,'');if(seen.has(key))return false;seen.add(key);return true;}).slice(0,30);
   if(!articles.length)throw Error('EG news unavailable');
   cached={articles,fetched:Date.now(),unavailable:feeds.filter((_,i)=>results[i].status==='rejected').map(feed=>feed.id)};
   return {...cached,stale:false};
  }catch{retryAfter=Date.now()+60000;if(cached)return {...cached,stale:true};throw Error('EG news temporarily unavailable');}
  finally{pending=null;}
 })();return pending;
}
