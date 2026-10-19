// Opt-in household sync. Local data is never imported implicitly.
(function(){
 const A=window.App,D=window.DATA;
 const keys={events:'frame-calendar-events-v1',chores:'frame-chore-templates-v1',completions:'frame-chore-completions-v1',meals:'frame-meals-v1',reminders:'frame-reminders-v1',shopping:'frame-shopping-v1',usuals:'frame-usuals-v1',education:'frame-education-beyza-v1'};
 const names={events:'Calendar events',chores:'Chores',completions:'Chore completions',meals:'Meals',reminders:'Reminders',shopping:'Shopping',usuals:'Usuals',education:'Education',photos:'Photos'};
 const enabledKey='frame-household-sync-v1',queueKey='frame-household-pending-v1';
 let enabled=localStorage.getItem(enabledKey)==='yes',applying=false,running=false,remote={},pending={},conflicts={},status='Not connected',connecting=false,timer;
 try{pending=JSON.parse(localStorage.getItem(queueKey)||'{}');}catch(_){}
 try{const revisions=JSON.parse(localStorage.getItem('frame-household-revisions-v1')||'{}');for(const [category,item] of Object.entries(revisions))if(names[category]&&Number.isSafeInteger(item.revision))remote[category]=item;}catch(_){}
 const nativeSet=Storage.prototype.setItem;
 function remember(doc){remote[doc.category]=doc;const revisions=Object.fromEntries(Object.entries(remote).map(([k,v])=>[k,{revision:v.revision,...(k==='photos'?{value:v.value}:{})}]));nativeSet.call(localStorage,'frame-household-revisions-v1',JSON.stringify(revisions));}
 const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 function keepQueue(){nativeSet.call(localStorage,queueKey,JSON.stringify(pending));}
 function state(message){status=message;const b=document.querySelector('[data-family-sync]');if(b)b.title='Family sync · '+status;}
 function code(){return localStorage.getItem('frame-calendar-code')||'';}
 async function request(path,method='GET',body){const r=await fetch(path,{method,headers:{Authorization:'Bearer '+code(),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(45000)});const data=await r.json();if(!r.ok){const error=new Error(data.error||'Sync unavailable');error.status=r.status;throw error;}return data;}
 function enqueue(category,value){if(!enabled||applying)return;pending[category]={value,revision:remote[category]?.revision||0};keepQueue();state('Saving…');clearTimeout(timer);timer=setTimeout(sync,800);}
 Storage.prototype.setItem=function(key,value){const old=this.getItem(key);nativeSet.call(this,key,value);if(this===localStorage&&old!==String(value)){const category=Object.keys(keys).find(c=>keys[c]===key);if(category){try{enqueue(category,JSON.parse(value));}catch(_){}}}};
 async function uploadPhotos(photos,progress=()=>{}){let count=0;for(const photo of photos){progress('Uploading photo '+(++count)+' of '+photos.length+'…');const signed=await request('/api/household-photos','POST',{id:photo.id});const r=await fetch(signed.url,{method:'PUT',headers:{'Content-Type':photo.blob.type||'image/jpeg','x-upsert':'true'},body:photo.blob,signal:AbortSignal.timeout(120000)});if(!r.ok)throw new Error('Photo upload failed. Local photos are safe.');}}
 async function changedPhotos(){if(!enabled||applying)return;try{const photos=await A.exportPhotoRecords(),metadata=photos.map(({blob,...p})=>p);if(canonical(metadata)===canonical(pending.photos?.value||remote.photos?.value||[]))return;enqueue('photos',metadata);}catch(error){state(error.message);}}
 async function apply(doc){
  applying=true;
  try{
   if(doc.category==='photos'){const payload=await request('/api/household-photos');await A.applySharedPhotoRecords(payload.photos);}
   else {const key=keys[doc.category];if(key){const value=JSON.stringify(doc.value);nativeSet.call(localStorage,key,value);if(doc.category==='shopping')D.groceries=doc.value;if(doc.category==='usuals')D.usuals=doc.value;window.dispatchEvent(new StorageEvent('storage',{key,newValue:value,storageArea:localStorage}));}}
   remember(doc);A.emit('data');if(!document.querySelector('#sheetLayer .sheet'))A.rerender();
  }finally{applying=false;}
 }
 async function sync(){
  if(!enabled||running||!navigator.onLine)return;running=true;
  try{
   const versions=Object.fromEntries(Object.entries(remote).filter(([,v])=>v.value!==undefined).map(([k,v])=>[k,v.revision]));
   const cloud=await request('/api/household?versions='+encodeURIComponent(JSON.stringify(versions)));if(!cloud.initialized){state('Import from the tablet first');return;}
   for(const doc of cloud.documents){if(pending[doc.category]){if(pending[doc.category].revision!==doc.revision)conflicts[doc.category]=doc;else remember(doc);}else if(remote[doc.category]?.revision!==doc.revision)await apply(doc);}
   for(const category of Object.keys(pending)){
    if(conflicts[category])continue;
    const change=pending[category];try{if(category==='photos'){const photos=await A.exportPhotoRecords(),oldIds=new Set((remote.photos?.value||[]).map(p=>p.id));await uploadPhotos(photos.filter(p=>change.value.some(m=>m.id===p.id)&&!oldIds.has(p.id)));}const result=await request('/api/household','PUT',{category,value:change.value,revision:change.revision});remember(result.document);if(pending[category]===change)delete pending[category];else if(pending[category])pending[category].revision=result.document.revision;keepQueue();}catch(error){if(error.status===409){state('Changes need review');continue;}throw error;}
   }
   state(Object.keys(conflicts).length?'Changes need review':Object.keys(pending).length?'Changes waiting to sync':'Up to date');
  }catch(error){state(error.status===401?'Connect with your frame code':error.message);}finally{running=false;}
 }
 async function connect(importDevice,progress=()=>{}){
  if(connecting)throw new Error('An import is already running.');
  connecting=true;A.householdImporting=true;
  try{
  progress('Checking shared household…');
  const cloud=await request('/api/household');
  if(importDevice){
   if(cloud.initialized)throw new Error('Shared data already exists. Use Connect this device instead. Nothing was overwritten.');
   progress('Saving a safety backup on this device…');
   const backup=await A.saveHouseholdBackupLocal();const photos=await A.exportPhotoRecords();await uploadPhotos(photos,progress);
   progress('Saving your lists and plans…');
   const documents={...backup.documents,photos:photos.map(({blob,...p})=>p)};
   if(!documents.chores)documents.chores=D.choreTemplates;
   for(const category of ['events','meals','reminders','shopping','usuals'])if(!documents[category])documents[category]=[];
   if(!documents.completions)documents.completions={};
   if(!documents.education&&A.defaultEducationState)documents.education=A.defaultEducationState();
   await request('/api/household','POST',{documents});
  }else{
   if(!cloud.initialized)throw new Error('Import your tablet first, then connect other devices.');
   progress('Saving a safety backup on this device…');await A.saveHouseholdBackupLocal();
  }
  enabled=true;nativeSet.call(localStorage,enabledKey,'yes');pending={};conflicts={};remote={};keepQueue();progress('Connecting this device…');await sync();
  }finally{connecting=false;A.householdImporting=false;if(A.resetIdle)A.resetIdle();}
 }
 A.familySyncSheet=function(){
  const conflictNames=Object.keys(conflicts);
  A.sheet('<div class="sheet-pad"><div class="label">Private household</div><h2 class="serif sheet-h">Family sync</h2><p class="sheet-p">'+A.esc(status)+'</p><p class="sheet-p">First, open this on your tablet and import its existing data. Then connect other devices. A safety backup is saved on this device before import or connection. You can also download a backup separately. Photos are shared privately.</p><p role="status" data-sync-message></p>'+(!code()?'<button class="btn btn--solid" data-sync-unlock>Connect with frame code</button>':'')+'<div class="sheet-actions"><button class="btn btn--ghost" data-sync-backup>Download device backup</button>'+(enabled?'<button class="btn btn--solid" data-sync-now>Sync now</button><button class="btn btn--ghost" data-sync-stop>Disconnect this device</button>':'<button class="btn btn--solid" data-sync-import>Import this device first</button><button class="btn btn--ghost" data-sync-connect>Connect to existing household</button>')+'</div>'+conflictNames.map(c=>'<div class="sheet-p"><b>'+names[c]+' changed on another device</b><p>Choose which version to keep. Your local changes stay saved until you decide.</p><button class="btn btn--ghost" data-sync-cloud="'+c+'">Use shared version</button><button class="btn btn--ghost" data-sync-local="'+c+'">Keep this device’s version</button></div>').join('')+'<p class="sheet-p">Updates normally appear within 30 seconds while devices are online. This does not change your iCloud calendar.</p></div>',{onMount(sheet){const message=sheet.querySelector('[data-sync-message]');sheet.addEventListener('click',async event=>{const b=event.target.closest('button');if(!b)return;b.disabled=true;try{if(b.hasAttribute('data-sync-unlock')){A.unlockCalendar();return;}if(b.hasAttribute('data-sync-backup')){await A.downloadHouseholdBackup();message.textContent='Backup downloaded.';}else if(b.hasAttribute('data-sync-import')||b.hasAttribute('data-sync-connect')){message.textContent='Preparing backup and connecting…';await connect(b.hasAttribute('data-sync-import'),text=>{message.textContent=text;});message.textContent=status;}else if(b.hasAttribute('data-sync-now')){await sync();message.textContent=status;}else if(b.hasAttribute('data-sync-stop')){enabled=false;nativeSet.call(localStorage,enabledKey,'no');state('Disconnected. Local data kept.');message.textContent=status;}else if(b.dataset.syncCloud){const c=b.dataset.syncCloud;delete pending[c];keepQueue();await apply(conflicts[c]);delete conflicts[c];await sync();message.textContent=status;}else if(b.dataset.syncLocal){const c=b.dataset.syncLocal;pending[c].revision=conflicts[c].revision;delete conflicts[c];keepQueue();await sync();message.textContent=status;}}catch(error){message.textContent=error.message;}finally{b.disabled=false;}});}});
 };
 A.syncHouseholdNow=sync;
 A.connectHousehold=connect;
 A.householdSyncState=()=>({enabled,status,pending:Object.keys(pending),conflicts:Object.keys(conflicts)});
 A.on('photos',changedPhotos);
 A.on('ready',()=>{const button=document.createElement('button');button.className='rail-credits';button.dataset.familySync='';button.textContent='Family sync';button.onclick=A.familySyncSheet;document.querySelector('.rail-credits').before(button);state(enabled?'Connecting…':'Not connected');sync();setInterval(sync,30000);window.addEventListener('online',sync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});});
})();
