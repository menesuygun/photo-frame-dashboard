import {createHash,randomUUID,createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {supabase,validateDocument} from './household.js';
import {listNames,equal,today,choreDate,project,fromGoogle,marker,googlePayload,googleMarker,localItem} from './google-tasks-model.js';
export const origin='https://photo-frame-dashboard-neon.vercel.app';
export const redirect=origin+'/api/google-tasks?action=callback';
export const oauthReady=()=>!!(process.env.GOOGLE_TASKS_CLIENT_ID&&process.env.GOOGLE_TASKS_CLIENT_SECRET);
const household=()=>process.env.HOUSEHOLD_ID;
const table=()=>'/rest/v1/household_google_tasks?household=eq.'+encodeURIComponent(household());
const secret=()=>createHash('sha256').update(process.env.FRAME_ACCESS_CODE+'|'+process.env.GOOGLE_TASKS_CLIENT_SECRET).digest();
export function seal(value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret(),iv),data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url');}
export function unseal(value){const b=Buffer.from(value,'base64url'),d=createDecipheriv('aes-256-gcm',secret(),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8'));}
export async function connection(){return (await supabase(table()+'&select=credentials,state,last_sync'))[0]||null;}
export async function lease(){const token=randomUUID(),rows=await supabase('/rest/v1/rpc/lock_google_tasks',{method:'POST',body:{p_household:household(),p_token:token}});if(!rows.length)throw Error('Another device is syncing Google Tasks. Try again in a moment.');return {token,row:rows[0]};}
export async function release(token){await supabase(table()+'&lock_token=eq.'+token,{method:'PATCH',body:{lock_token:null,locked_until:null}});}
export async function setCredentials(token,tokens){await supabase(table()+'&lock_token=eq.'+token,{method:'PATCH',body:{credentials:tokens?seal(tokens):null}});}
export async function tokenRequest(fields){const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_TASKS_CLIENT_ID,client_secret:process.env.GOOGLE_TASKS_CLIENT_SECRET,...fields}),signal:AbortSignal.timeout(12000)});const data=await response.json();if(!response.ok)throw Error('Google authorization expired or was declined. Reconnect Google Tasks.');return data;}
async function googleClient(row,token){
 let credentials;try{credentials=unseal(row.credentials);}catch{throw Error('Reconnect Google Tasks after the connection settings changed.');}
 if(!credentials.access_token||credentials.expires_at<Date.now()+60000){const renewed=await tokenRequest({grant_type:'refresh_token',refresh_token:credentials.refresh_token});credentials={...credentials,...renewed,expires_at:Date.now()+renewed.expires_in*1000};await setCredentials(token,credentials);}
 return async(path,{method='GET',body,etag}={})=>{
  const response=await fetch('https://tasks.googleapis.com/tasks/v1/'+path,{method,headers:{Authorization:'Bearer '+credentials.access_token,...(body?{'Content-Type':'application/json'}:{}),...(etag?{'If-Match':etag}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
  if(!response.ok){if(response.status===412)throw Error('A Google task changed during sync. Sync again to review the latest version.');if(response.status===401)throw Error('Reconnect Google Tasks.');if(response.status===404)throw Error('A connected Google Tasks list or item was removed. Restore it or reconnect after reviewing your lists.');if(response.status===403)throw Error('Enable Google Tasks API and allow Tasks access when connecting.');if(response.status===429)throw Error('Google Tasks is busy. Wait a minute before syncing again.');throw Error('Google Tasks could not be reached. Your changes will be retried.');}
  return response.status===204?null:response.json();
 };
}
async function pages(api,path){let items=[],next;do{const data=await api(path+(path.includes('?')?'&':'?')+'maxResults=100'+(next?'&pageToken='+encodeURIComponent(next):''));items.push(...(data.items||[]));next=data.nextPageToken;if(items.length>2000)throw Error('This Google Tasks list is too large to sync safely. Use dedicated household lists.');}while(next);return items;}
const docPath=()=>'/rest/v1/household_documents?household=eq.'+encodeURIComponent(household())+'&category=in.(chores,completions,reminders,shopping)&select=category,value,revision';
function emptyState(){return {lists:{},links:{},conflicts:{}};}
export async function synchronize({force=false,resolution}={}){
 const {token,row}=await lease();
 try{
  if(!row.credentials)throw Error('Connect Google Tasks first.');
  if(!force&&row.last_sync&&Date.now()-Date.parse(row.last_sync)<60000)return {connected:true,lastSync:row.last_sync,conflicts:Object.values(row.state?.conflicts||{})};
  const api=await googleClient(row,token),state={...emptyState(),...row.state},docs=Object.fromEntries((await supabase(docPath())).map(d=>[d.category,d]));
  if(!Object.keys(docs).length)throw Error('Connect Family sync and import your household before connecting Google Tasks.');
  for(const c of ['chores','reminders','shopping','completions'])if(!docs[c])docs[c]={category:c,value:c==='completions'?{}:[],revision:0};
  let writes=0,more=false;const deadline=Date.now()+30000;
  async function checkpoint(changes=[],finished=false){for(const d of changes)if(!validateDocument(d.category,d.value))throw Error('A Google task contains information the dashboard cannot save. Review its name and notes.');await supabase('/rest/v1/rpc/commit_google_tasks',{method:'POST',body:{p_household:household(),p_token:token,p_changes:changes,p_state:state,p_finished:finished}});for(const d of changes)docs[d.category]={...d,revision:d.revision+1};}
  const lists=await pages(api,'users/@me/lists');
  for(const [category,name] of Object.entries(listNames).sort(([a],[b])=>Number(resolution?.key?.startsWith(b+':'))-Number(resolution?.key?.startsWith(a+':')))){
   if(state.lists[category]&&!lists.some(l=>l.id===state.lists[category]))throw Error('The '+name+' Google Tasks list is missing. Restore it before syncing; dashboard items have been kept.');
   if(!state.lists[category]){const matches=lists.filter(l=>l.title.toLowerCase()===name.toLowerCase());if(matches.length>1)throw Error('More than one Google Tasks list is named '+name+'. Rename the extra lists before connecting.');const list=matches[0]||await api('users/@me/lists',{method:'POST',body:{title:name}});state.lists[category]=list.id;await checkpoint();}
   const path='lists/'+encodeURIComponent(state.lists[category])+'/tasks';
   const remoteTasks=await pages(api,path+'?showCompleted=true&showHidden=true&showDeleted=true&showAssigned=false');
   const byId=new Map(remoteTasks.map(t=>[t.id,t]));
   // Stable markers recover successful Google creates after a network interruption.
   for(const item of docs[category].value){const key=category+':'+item.id;if(state.links[key])continue;const identity=marker(household(),category,item.id),matches=remoteTasks.filter(t=>!t.deleted&&googleMarker(t)===identity);if(matches.length>1)throw Error('Duplicate linked Google tasks need review before syncing.');if(matches.length)state.links[key]={category,localId:item.id,remoteId:matches[0].id,local:null,remote:null};}
   const work=new Set([...docs[category].value.map(i=>category+':'+i.id),...Object.keys(state.links).filter(k=>state.links[k].category===category)]);
   // First connection imports open tasks only, never historical completed/deleted tasks.
   for(const task of remoteTasks){if(task.deleted||task.status==='completed'||task.assignmentInfo||Object.values(state.links).some(l=>l.category===category&&l.remoteId===task.id))continue;const id='google-'+createHash('sha256').update(state.lists[category]+'|'+task.id).digest('hex').slice(0,32),key=category+':'+id;state.links[key]={category,localId:id,remoteId:task.id,local:null,remote:null};work.add(key);}
   for(const key of [...work].sort((a,b)=>Number(b===resolution?.key)-Number(a===resolution?.key))){
    if(writes>=20||Date.now()>deadline){more=true;break;}
    let link=state.links[key],id=link?.localId||key.slice(category.length+1),item=docs[category].value.find(i=>i.id===id),task=link&&byId.get(link.remoteId),local=project(category,item,docs.completions.value),remote=task?fromGoogle(category,task,link?.remote?.due||local?.due||today()):null;
    // Old one-off completion records are pruned by the dashboard after 31 days.
    if(category==='chores'&&local&&link?.local?.done&&!item.every&&item.weekday==null&&Date.parse(local.due)<Date.parse(today())-31*86400000)local.done=true;
    if(task?.assignmentInfo)throw Error('Tasks assigned from Docs or Chat cannot be edited by this connection.');
    let direction;
    if(!link)direction='push';
    else if(link.local===null&&link.remote===null){direction=local?(equal(local,remote)?'equal':'conflict'):'pull';}
    else{
     const lc=!equal(local,link.local),rc=!equal(remote,link.remote);
     if(!lc&&!rc){delete state.conflicts[key];continue;}
     if(equal(local,remote))direction='equal';
     else if(lc&&rc)direction='conflict';
     else direction=lc?'push':'pull';
     // Changing a repeating chore's date in Google changes its schedule: require a choice.
     if(direction==='pull'&&category==='chores'&&item&&(item.every>0||item.weekday!=null)&&remote&&remote.due!==link.remote?.due)direction='conflict';
    }
    const conflict=state.conflicts[key];
    if(resolution?.key===key){if(!conflict||!equal(local,conflict.local)||!equal(remote,conflict.google))throw Error('This item changed again. Review its latest versions before choosing.');direction=resolution.choice==='google'?'pull':'push';}
    if(direction==='conflict'){state.conflicts[key]={key,category,title:item?.title||item?.name||task?.title||'Removed item',local,google:remote,recurring:category==='chores'&&!!(item?.every||item?.weekday!=null)};await checkpoint();continue;}
    const changes=[];
    if(direction==='push'){
     if(!local){if(task&&!task.deleted)await api(path+'/'+encodeURIComponent(task.id),{method:'DELETE',etag:task.etag});remote=null;}
     else{
      const payload=googlePayload(category,local,task||{},marker(household(),category,id));
      if(task&&!task.deleted)task=await api(path+'/'+encodeURIComponent(task.id),{method:'PATCH',body:payload,etag:task.etag});
      else task=await api(path,{method:'POST',body:payload});
      remote=fromGoogle(category,task);byId.set(task.id,task);
     }
    }else if(direction==='pull'){
     const next=remote?localItem(category,id,remote,item):null;
     changes.push({...docs[category],value:next?docs[category].value.filter(i=>i.id!==id).concat([next]):docs[category].value.filter(i=>i.id!==id)});
     if(category==='chores'&&remote){const completions={...docs.completions.value},occurrence=id+':'+remote.due;if(remote.done)completions[occurrence]={by:remote.who==='any'?null:remote.who};else delete completions[occurrence];changes.push({...docs.completions,value:completions});}
     local=remote;
    }
    if(!local&&!remote){delete state.links[key];delete state.conflicts[key];}
    else{state.links[key]={category,localId:id,remoteId:task?.id||link.remoteId,local,remote};delete state.conflicts[key];}
    await checkpoint(changes);writes++;
   }
   if(more)break;
  }
  await checkpoint([],!more);
  return {connected:true,lastSync:more?row.last_sync:new Date().toISOString(),more,conflicts:Object.values(state.conflicts)};
 }finally{await release(token).catch(()=>{});}
}
