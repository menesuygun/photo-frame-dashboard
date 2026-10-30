// Shared projections make edits comparable without discarding dashboard-only settings.
import {createHash} from 'node:crypto';
export const listNames={chores:'Chores',reminders:'Reminders',shopping:'Shopping'};
const people=['enes','beyza','atlas','miyam'];
const categories=['Produce','Bakery','Meat & Deli','Dairy & Eggs','Pantry','Frozen','Snacks','Household','Hardware & DIY','Other'];
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(key=>[key,v[key]])):v);
export const equal=(a,b)=>canonical(a)===canonical(b);
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const add=(date,n)=>{const d=new Date(date+'T12:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export function choreDate(chore,date=today()){
 if(chore.weekday!=null){let d=date;for(let i=0;i<7;i++,d=add(d,1))if(new Date(d+'T12:00Z').getUTCDay()===chore.weekday)return d;}
 if(!chore.every)return chore.start;
 const delta=(Date.parse(date+'T12:00Z')-Date.parse(chore.start+'T12:00Z'))/86400000;
 return delta<=0?chore.start:add(date,(chore.every-delta%chore.every)%chore.every);
}
export function project(category,item,completions={}){
 if(!item)return null;
 if(category==='reminders')return {title:item.title,done:item.done};
 if(category==='shopping')return {title:item.name,done:item.done,qty:item.qty,store:item.store,cat:item.cat};
 const due=choreDate(item);
 return {title:item.title,done:!!completions[item.id+':'+due],due,who:item.who};
}
function noteField(notes,name){return String(notes||'').split('\n').find(line=>line.toLowerCase().startsWith(name.toLowerCase()+':'))?.slice(name.length+1).trim();}
export function fromGoogle(category,task,fallbackDate=today()){
 if(!task||task.deleted)return null;
 const title=String(task.title||'').trim();
 if(!title)throw Error('A Google task has no title. Add a title before syncing.');
 const base={title,done:task.status==='completed'};
 if(category==='reminders'){if(title.length>200)throw Error('Shorten reminder titles to 200 characters before syncing.');return base;}
 if(category==='shopping'){
  if(title.length>120)throw Error('Shorten shopping item names to 120 characters before syncing.');
  const raw=noteField(task.notes,'Quantity')||'1',qty=Number(raw),storeName=noteField(task.notes,'Store')||'Grocery Store',cat=noteField(task.notes,'Category')||'Other';
  const stores={'grocery store':'grocer',costco:'costco',other:'other'};
  if(!Number.isInteger(qty)||qty<1||qty>999||!stores[storeName.toLowerCase()]||!categories.includes(cat))throw Error('Shopping notes need a positive Quantity, Store (Grocery Store, Costco or Other), and a dashboard Category.');
  return {...base,qty,store:stores[storeName.toLowerCase()],cat};
 }
 const tag=title.match(/^\[(Enes|Beyza|Atlas|Miyam|Anyone)\]\s*/i),name=tag?title.slice(tag[0].length):title;
 if(!name||name.length>120)throw Error('Use a chore name up to 120 characters after the person tag.');
 const due=task.due?.slice(0,10)||fallbackDate;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due+'T12:00Z')))throw Error('Invalid Google chore date.');
 return {title:name,done:base.done,due,who:tag&&people.includes(tag[1].toLowerCase())?tag[1].toLowerCase():'any'};
}
export function marker(household,category,id){return createHash('sha256').update(household+'|'+category+'|'+id).digest('hex');}
export function googlePayload(category,value,old={},identity){
 let title=value.title,notes=String(old.notes||'');
 if(category==='chores'&&value.who!=='any')title='['+value.who[0].toUpperCase()+value.who.slice(1)+'] '+title;
 const managed=category==='shopping'?['Quantity','Store','Category','Frame ID']:['Frame ID'];
 notes=notes.split('\n').filter(line=>!managed.some(name=>line.toLowerCase().startsWith(name.toLowerCase()+':'))).join('\n').trim();
 const extra=category==='shopping'?['Quantity: '+value.qty,'Store: '+({grocer:'Grocery Store',costco:'Costco',other:'Other'}[value.store]),'Category: '+value.cat]:[];
 notes=[notes,...extra,'Frame ID: '+identity].filter(Boolean).join('\n');
 if(notes.length>8192)throw Error('Google task notes are too long to add sync information.');
 return {title,notes,status:value.done?'completed':'needsAction',...(!value.done?{completed:null}:{}),...(category==='chores'?{due:value.due+'T00:00:00.000Z'}:{})};
}
export function localItem(category,id,value,old){
 if(category==='reminders')return {...old,id,title:value.title,done:value.done};
 if(category==='shopping')return {...old,id,name:value.title,done:value.done,qty:value.qty,store:value.store,cat:value.cat};
 // A Google date edit converts the repeating template to a one-off, explicitly reviewed in the UI.
 const changedDate=old&&choreDate(old)!==value.due;
 return {...old,id,title:value.title,who:value.who,r:old?.r||'after',emoji:old?.emoji||'📋',stars:old?.stars||0,start:!old||changedDate?value.due:old.start,every:!old||changedDate?0:old.every,...(changedDate?{weekday:null}:{}),label:!old||changedDate?'Once · '+value.due:old.label};
}
export function googleMarker(task){return noteField(task.notes,'Frame ID');}
