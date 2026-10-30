// Google credentials stay on the server; devices use the existing frame access code.
(function(){
 const A=window.App;let running=false,status=null,lastError='',sheetRoot=null;
 const esc=A.esc;
 async function request(action,body){const response=await fetch('/api/google-tasks?action='+action,{method:body?'POST':'GET',cache:'no-store',headers:{Authorization:'Bearer '+(localStorage.getItem('frame-calendar-code')||''),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(55000)});const data=await response.json();if(!response.ok)throw Error(data.error||'Google Tasks is unavailable.');return data;}
 function summary(value){if(!value)return 'Removed';return [value.title,value.done?'Completed':'Not completed',value.due||'',value.who&&value.who!=='any'?A.person(value.who).name:'',value.qty?'Quantity: '+value.qty:'',value.store?({grocer:'Grocery Store',costco:'Costco',other:'Other'}[value.store]):'',value.cat||''].filter(Boolean).join(' · ');}
 function render(){if(!sheetRoot?.isConnected)return;
  sheetRoot.innerHTML='<div class="sheet-pad google-tasks-settings"><div class="label">Connected lists</div><h2 class="serif sheet-h">Google Tasks</h2><p class="sheet-p">Sync Chores, Reminders, and Shopping in both directions with one Google account for your household. Only the three connected lists are synced.</p><div class="gt-list-map"><span>Google list</span><span>Dashboard</span><b>Chores</b><b>Chores</b><b>Reminders</b><b>Reminders</b><b>Shopping</b><b>Shopping</b></div><p class="sheet-p">Use [Enes], [Beyza], [Atlas], or [Miyam] at the start of a chore name. Untagged chores go to Anyone; new chores use Afternoon until you change them here. Chores without a Google date start today.</p><p class="sheet-p">Shopping notes can include separate lines such as “Quantity: 2”, “Store: Costco”, and “Category: Meat &amp; Deli”. Without these, new items use quantity 1, Grocery Store, and Other.</p><p class="sheet-p">Repeating chores stay scheduled here; Google shows their next occurrence. Morning, Afternoon, Evening, and repeat settings are managed here.</p><p role="status" data-gt-status>'+esc(lastError||(status?.connected?(status.more?'More items are waiting to sync.':status.lastSync?'Last synced '+new Date(status.lastSync).toLocaleString():'Connected. Ready to sync.'):'Not connected.'))+'</p>'+(status?.setup?'<p class="sheet-p">The private Google Tasks database needs its one-time setup.</p>':status&&!status.configured?'<p class="sheet-p">Google sign-in needs its one-time setup before connecting.</p>':'')+'<div class="sheet-actions">'+(status?.connected?'<button class="btn btn--solid" data-gt-sync>Sync now</button><button class="btn btn--ghost" data-gt-connect>Reconnect Google</button><button class="btn btn--ghost" data-gt-disconnect>Disconnect Google Tasks</button>':'<button class="btn btn--solid" data-gt-connect '+(!status||!status.configured||status.setup?'disabled':'')+'>Connect Google Tasks</button>')+'<button class="btn btn--ghost" data-gt-refresh>Refresh status</button></div><p class="sheet-p">Updates sync about once a minute while a connected dashboard is open. Removing a linked item removes it from both places. Disconnecting keeps your existing lists and items.</p>'+(status?.conflicts||[]).map(c=>'<section class="gt-conflict"><h3>'+esc(c.title)+'</h3><p>'+esc(({chores:'Chores',reminders:'Reminders',shopping:'Shopping'})[c.category]||'Item')+' changed in both places. Choose which version to keep.</p><p><b>Dashboard:</b> '+esc(summary(c.local))+'</p><p><b>Google Tasks:</b> '+esc(summary(c.google))+'</p>'+(c.recurring?'<p>If you keep a different Google date, this chore becomes a one-off on that date.</p>':'')+'<div class="sheet-actions"><button class="btn btn--ghost" data-gt-choice="dashboard" data-gt-key="'+esc(c.key)+'">Keep dashboard version</button><button class="btn btn--ghost" data-gt-choice="google" data-gt-key="'+esc(c.key)+'">Keep Google version</button></div></section>').join('')+'</div>';
 }
 async function refresh(){try{status=await request('status');lastError=status.error||'';}catch(error){lastError=error.message;}render();}
 async function sync(force=false,resolution){if(running||!navigator.onLine)return;running=true;try{
  const family=A.householdSyncState?.();if(!family?.enabled)throw Error('Connect Family sync on this device first.');
  await A.syncHouseholdNow();const saved=A.householdSyncState();
  if(saved.pending.length||saved.conflicts.length||saved.status!=='Up to date')throw Error('Finish Family sync and resolve its pending changes before syncing Google Tasks.');
  if(sheetRoot?.isConnected)sheetRoot.querySelector('[data-gt-status]').textContent='Syncing your lists…';
  const result=await request('sync',{force,...(resolution?{resolution}:{})});status={...status,...result};lastError='';await A.syncHouseholdNow();
 }catch(error){lastError=error.message;}finally{running=false;render();}}
 A.googleTasksSheet=function(){
  A.sheet('<div class="sheet-pad"><h2 class="serif sheet-h">Google Tasks</h2><p>Loading connection…</p></div>',{onMount(root){
   const content=document.createElement('div');root.append(content);root.querySelector('.sheet-pad').remove();sheetRoot=content;
   content.addEventListener('click',async event=>{const button=event.target.closest('button');if(!button||button.disabled)return;button.disabled=true;try{
    if(button.hasAttribute('data-gt-refresh'))return await refresh();
    if(button.hasAttribute('data-gt-sync'))return await sync(true);
    if(button.dataset.gtChoice)return await sync(true,{key:button.dataset.gtKey,choice:button.dataset.gtChoice});
    if(button.hasAttribute('data-gt-connect')){const family=A.householdSyncState?.();if(!family?.enabled)throw Error('Connect Family sync on this device first.');const data=await request('authorize',{});window.location.assign(data.url);}
    if(button.hasAttribute('data-gt-disconnect')){await request('disconnect',{});status={...status,connected:false,conflicts:[]};lastError='Disconnected. Your lists and items were kept.';render();}
   }catch(error){lastError=error.message;render();}finally{button.disabled=false;}});
   render();refresh();
  }});
 };
 async function tick(){if(document.hidden||!navigator.onLine||!A.householdSyncState?.().enabled||running)return;await refresh();if(status?.connected)await sync();}
 A.on('ready',()=>{setTimeout(tick,5000);setInterval(tick,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});});
})();
