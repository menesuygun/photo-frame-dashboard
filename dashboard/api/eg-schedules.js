// Read-only public recreation schedules. No household or Google data is sent to EG.
const base='https://anc.ca.apm.activecommunities.com/eastgwillimbury';
const programs={aquatic:{calendar:2,centers:[27]},gym:{calendar:6,centers:[27,9]}};
const cache=new Map(),pending=new Map(),ttl=5*60*1000;
const clean=(value,max=300)=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim().slice(0,max);
async function read(program){
 const source=base+'/calendars?locale=en-US';
 const page=await fetch(source,{signal:AbortSignal.timeout(12000)});
 if(!page.ok)throw Error('Town calendar unavailable');
 const cookies=page.headers.getSetCookie?.().map(cookie=>cookie.split(';')[0]).join('; ')||'';
 const html=await page.text(),csrf=html.match(/window\.__csrfToken\s*=\s*"([^"]+)"/)?.[1];
 if(!csrf)throw Error('Town calendar format changed');
 const {calendar,centers}=programs[program];
 const response=await fetch(base+'/rest/onlinecalendar/multicenter/events',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-Token':csrf,Cookie:cookies,Referer:source},body:JSON.stringify({calendar_id:calendar,center_ids:centers,display_all:0,search_start_time:'',search_end_time:'',facility_ids:[],activity_category_ids:[],activity_sub_category_ids:[],activity_ids:[],event_type_ids:[]}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Town schedule unavailable');
 const payload=await response.json();
 if(payload.headers?.response_code!=='0000'||!Array.isArray(payload.body?.center_events))throw Error('Town calendar format changed');
 const events=[],seen=new Set();
 for(const center of payload.body.center_events){
  if(!Array.isArray(center.events))throw Error('Town calendar format changed');
  for(const event of center.events){
   if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(event.start_time)||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(event.end_time))continue;
   const facilities=(event.facilities||[]).map(f=>clean(f.facility_name,120)).filter(Boolean).join(', ');
   const id=[center.center_id,event.event_item_id,event.start_time,event.end_time,facilities].join('|');
   if(seen.has(id))continue;seen.add(id);
   events.push({id,title:clean(event.title,200),start:event.start_time,end:event.end_time,center:clean(center.center_name),facilities,description:clean(event.description,3000),price:clean(event.price?.estimate_price,80)});
  }
 }
 if(events.length>3000)throw Error('Town schedule is too large');
 events.sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title));
 return {program,timeZone:'America/Toronto',updated:new Date().toISOString(),events,source:'https://www.eastgwillimbury.ca/en/living-in-eg/drop-in-programs.aspx'};
}
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const program=String(req.query?.program||'aquatic');if(!Object.hasOwn(programs,program))return res.status(400).json({error:'Choose Aquatic or Gymnasium.'});
 const refresh=req.query?.refresh==='1';
 res.setHeader('Cache-Control',refresh?'no-store':'public, s-maxage=300, max-age=0');
 try{
  let entry=cache.get(program);
  if(!entry||Date.now()-entry.at>ttl||(refresh&&Date.now()-entry.at>30000)){
   if(!pending.has(program))pending.set(program,read(program).then(data=>{const result={at:Date.now(),data};cache.set(program,result);return result;}).finally(()=>pending.delete(program)));
   entry=await pending.get(program);
  }
  return res.status(200).json(entry.data);
 }catch{res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'The town’s schedule is temporarily unavailable. Try Refresh or open the official schedule.'});}
}
