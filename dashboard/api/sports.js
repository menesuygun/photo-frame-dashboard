// Public football data, cached independently by resource. No household data is sent.
const ROOT='https://site.api.espn.com/apis/';
const cache=new Map(),inflight=new Map();
export async function cached(url,ttl,fetcher=fetch){
 const old=cache.get(url);if(old&&Date.now()-old.at<ttl)return old;
 if(inflight.has(url))return inflight.get(url);
 const task=(async()=>{try{const r=await fetcher(url,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Feed unavailable');const data=await r.json();const result={data,at:Date.now(),stale:false};cache.set(url,result);return result;}catch(e){if(old)return {...old,stale:true};throw e;}finally{inflight.delete(url);}})();inflight.set(url,task);return task;
}
export const torontoDate=(d=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export function match(e){const c=e.competitions?.[0]||{},s=c.status||e.status||{},t=s.type||{};const team=x=>({id:String(x?.team?.id||''),name:x?.team?.displayName||'TBD',logo:x?.team?.logo||x?.team?.logos?.[0]?.href||'',score:typeof x?.score==='object'?x.score.displayValue:x?.score??null});return {id:e.id,date:e.date||c.date,name:e.name,competition:e.league?.name||c.altGameNote||e.season?.displayName||'Football',home:team(c.competitors?.find(x=>x.homeAway==='home')),away:team(c.competitors?.find(x=>x.homeAway==='away')),state:t.state||'pre',status:t.shortDetail||t.description||'Scheduled',clock:s.displayClock||'',venue:c.venue?.fullName||'',timeValid:c.timeValid!==false&&e.timeValid!==false};}
export function tableRows(data){return (data.children||[]).flatMap(c=>c.standings?.entries||[]).map((e,i)=>{const stat=n=>e.stats?.find(x=>x.name===n)?.value??null;return {id:String(e.team.id),name:e.team.displayName,logo:e.team.logos?.[0]?.href||'',rank:stat('rank')??i+1,played:stat('gamesPlayed'),wins:stat('wins'),draws:stat('ties'),losses:stat('losses'),gd:stat('pointDifferential'),points:stat('points')};}).sort((a,b)=>a.rank-b.rank);}
const safeUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'?u.href:'';}catch{return '';}};
export function parseTurkishNews(xml){
 const decode=text=>text.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):+n;return code<=0x10ffff?String.fromCodePoint(code):'';});
 return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m=>{const value=tag=>decode(m[1].match(new RegExp('<'+tag+'(?: [^>]*)?>([\\s\\S]*?)</'+tag+'>'))?.[1]||'');const source=value('source'),title=value('title');return {title:source&&title.endsWith(' - '+source)?title.slice(0,-source.length-3):title,date:value('pubDate'),url:safeUrl(value('link')),source:source||'Google Haberler',image:''};}).filter(n=>n.title&&n.url&&Number.isFinite(Date.parse(n.date))).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,12);
}
async function resource(kind,date){
 if(kind==='scores'){const r=await cached(ROOT+'site/v2/sports/soccer/tur.1/scoreboard?dates='+date.replaceAll('-',''),60000);return {...r,data:(r.data.events||[]).map(match)};}
 if(kind==='standings'){const r=await cached(ROOT+'v2/sports/soccer/tur.1/standings',900000);return {...r,data:tableRows(r.data),season:r.data.children?.[0]?.name||''};}
 if(kind==='galatasaray'){const r=await cached(ROOT+'site/v2/sports/soccer/all/teams/432/schedule?fixture=true',60000);let recent;try{recent=await cached(ROOT+'site/v2/sports/soccer/all/teams/432/schedule',60000);}catch{}const events=new Map((r.data.events||[]).map(e=>[e.id,e]));for(const e of recent?.data?.events||[])if(torontoDate(new Date(e.date))===date)events.set(e.id,e);return {...r,stale:r.stale||recent?.stale,data:[...events.values()].map(match).sort((a,b)=>new Date(a.date)-new Date(b.date))};}
 if(kind==='news'){
  return cached('https://news.google.com/rss/search?q=Galatasaray+futbol+when:7d&hl=tr&gl=TR&ceid=TR:tr',900000,async(url,options)=>{const r=await fetch(url,options);return {ok:r.ok,json:async()=>parseTurkishNews(await r.text())};});
 }
 if(kind==='scorers'){
  const year=new Date(date+'T12:00:00Z').getUTCFullYear()-(+date.slice(5,7)<7?1:0);
  const r=await cached('https://sports.core.api.espn.com/v2/sports/soccer/leagues/tur.1/seasons/'+year+'/types/1/leaders',3600000);
  const categories=r.data.categories||[],goals=categories.find(c=>c.name==='goalsLeaders')?.leaders||[],assists=categories.find(c=>/assist/i.test(c.name))?.leaders||[];
  async function resolve(list){return Promise.all(list.slice(0,5).map(async x=>{const ref=x.athlete?.$ref?.replace('http:','https:');if(!ref||new URL(ref).hostname!=='sports.core.api.espn.com')throw Error('Invalid player');const athlete=await cached(ref,86400000);return {name:athlete.data.displayName||athlete.data.fullName,value:x.value};}));}
  return {...r,data:{goals:await resolve(goals),assists:await resolve(assists)}};
 }
 throw Error('Unknown section');
}
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const q=new URL(req.url,'https://dashboard.local').searchParams,kind=q.get('kind')||'overview',date=q.get('date')||torontoDate();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00Z'))||Math.abs(Date.parse(date+'T12:00Z')-Date.now())>370*86400000)return res.status(400).json({error:'Choose a date within one year'});
 if(!['overview','scores','standings','galatasaray','news','scorers','fixtures'].includes(kind))return res.status(400).json({error:'Unknown section'});
 try{
  let result;
  if(kind==='overview'){const types=['scores','standings','galatasaray','news','scorers'];const values=await Promise.allSettled(types.map(k=>resource(k,date)));result=Object.fromEntries(types.map((k,i)=>[k,values[i].status==='fulfilled'?values[i].value:{error:'Temporarily unavailable'}]));}
  else if(kind==='fixtures'){const days=Array.from({length:7},(_,i)=>new Date(Date.parse(date+'T12:00Z')+i*86400000).toISOString().slice(0,10));const results=await Promise.all(days.map(async day=>{try{return {date:day,...await resource('scores',day)};}catch{return {date:day,error:'Fixtures unavailable'};}}));result={days:results};}
  else result=await resource(kind,date);
  res.setHeader('Cache-Control','public, s-maxage=60');return res.status(200).json({source:'ESPN',timezone:'America/Toronto',date,result});
 }catch{return res.status(502).json({error:'Football feed temporarily unavailable'});}
}
