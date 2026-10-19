import {createHash,timingSafeEqual} from 'node:crypto';
export const categories=['events','chores','completions','meals','reminders','shopping','usuals','education','photos'];
export function authorized(req){const expected=process.env.FRAME_ACCESS_CODE;if(!expected)return false;const digest=value=>createHash('sha256').update(value).digest();return timingSafeEqual(digest(String(req.headers.authorization||'').replace(/^Bearer /,'')),digest(expected));}
export function configured(){return !!(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.HOUSEHOLD_ID);}
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,120}$/.test(v);
const text=(v,n)=>typeof v==='string'&&v.length<=n;
const date=v=>v===''||typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
export function validateDocument(category,value){
 if(!categories.includes(category)||value===null||typeof value!=='object')return false;
 const encoded=JSON.stringify(value);if(encoded.length>2*1024*1024||encoded.includes('"__proto__"')||encoded.includes('"constructor"'))return false;
 if(['events','chores','meals','reminders','shopping','usuals','photos'].includes(category)){
  if(!Array.isArray(value)||value.length>500)return false;
  if(category==='usuals')return value.length<=50&&value.every(v=>text(v,120)&&v.trim());
  if(category==='photos')return value.length<=100&&value.every(v=>record(v)&&/^[-a-f0-9]{36}$/i.test(v.id)&&['p','l'].includes(v.o)&&date(v.date)&&text(v.caption||'',160)&&text(v.location||'',160)&&Object.keys(v).every(k=>['id','o','date','dateSource','location','caption','fav'].includes(k)));
  if(!value.every(v=>record(v)&&id(v.id))||new Set(value.map(v=>v.id)).size!==value.length)return false;
  if(category==='events')return value.every(v=>/^dashboard-[a-z0-9-]+$/i.test(v.id)&&text(v.title,200)&&v.title.trim()&&typeof v.allDay==='boolean'&&Array.isArray(v.people)&&v.people.length>0&&v.people.length<=4&&v.people.every(p=>['enes','beyza','atlas','miyam'].includes(p))&&text(v.start,40)&&text(v.end,40)&&Number.isFinite(Date.parse(v.start))&&Date.parse(v.end)>Date.parse(v.start)&&(!v.allDay||(/^\d{4}-\d{2}-\d{2}$/.test(v.start)&&/^\d{4}-\d{2}-\d{2}$/.test(v.end)))&&text(v.loc,500)&&text(v.notes,2000));
  if(category==='reminders')return value.every(v=>text(v.title,200)&&v.title.trim()&&typeof v.done==='boolean');
  if(category==='meals')return value.every(v=>text(v.name,100)&&v.name.trim()&&date(v.date)&&['breakfast','lunch','dinner'].includes(v.type)&&(!v.photo||typeof v.photo==='string'&&/^data:image\/jpeg;base64,/.test(v.photo)));
  if(category==='shopping')return value.every(v=>text(v.name,120)&&Number.isInteger(v.qty)&&v.qty>0&&typeof v.done==='boolean'&&text(v.store,30)&&text(v.cat,100));
  if(category==='chores')return value.every(v=>text(v.title,120)&&v.title.trim()&&['enes','beyza','atlas','miyam','any'].includes(v.who)&&['morning','after','evening'].includes(v.r));
 }
 if(!record(value))return false;
 if(category==='education')return value.version===1&&value.courseId==='psyc6263-2026-fall'&&record(value.completions)&&record(value.settings);
 return Object.keys(value).length<=5000&&Object.entries(value).every(([k,v])=>/^[a-zA-Z0-9:.-]+$/.test(k)&&record(v)&&(v.by===null||['enes','beyza','atlas','miyam','any'].includes(v.by)));
}
export async function supabase(path,{method='GET',body}={},fetcher=fetch){
 const base=new URL(process.env.SUPABASE_URL);
 if(base.protocol!=='https:'||!base.hostname.endsWith('.supabase.co'))throw new Error('Invalid storage configuration');
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const authHeaders={apikey:secret,'Content-Type':'application/json'};
 if(!secret.startsWith('sb_secret_'))authHeaders.Authorization='Bearer '+secret;
 const response=await fetcher(new URL(path,base),{method,signal:AbortSignal.timeout(12000),headers:authHeaders,...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!response.ok)throw new Error('Shared storage unavailable');
 return response.status===204?null:response.json();
}
