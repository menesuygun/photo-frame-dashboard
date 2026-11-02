// Prayer audio is a per-device choice so every family device does not sound together.
(function(){
 const A=window.App,names=['Fajr','Dhuhr','Asr','Maghrib','Isha'],key='frame-adhan-settings-v1';
 let view=null,settings={Fajr:false,Dhuhr:false,Asr:false,Maghrib:false,Isha:false},enabled=false,message='',audio=null;
 const enabledKey='frame-adhan-auto-enabled-v1',firedMemory=new Set(),attempts=new Map();
 let unlocked=false,blocked=false,checking=false,activeAutomatic=null,pendingPrayer=null,playGeneration=0;
 function read(key){try{return localStorage.getItem(key);}catch{return null;}}
 function save(key,value){try{localStorage.setItem(key,value);}catch{}}
 function remove(key){try{localStorage.removeItem(key);}catch{}}
 try{const saved=JSON.parse(localStorage.getItem(key)||'{}');for(const name of names)settings[name]=saved[name]===true;}catch{}
 // Restore the device's selected-prayer intent; browser playback permission is separate.
 enabled=read(enabledKey)==='yes'||(read(enabledKey)===null&&names.some(name=>settings[name]));
 if(enabled)save(enabledKey,'yes');
 message=enabled?'Automatic adhan is saved for this device. After a refresh, tap Enable & test audio to confirm sound is allowed.':'Tap Enable & test audio on this device before automatic playback.';
 function status(){render();A.emit('adhan-status');}
 A.adhanAudioLabel=function(){if(!enabled||!names.some(name=>settings[name]))return '';return blocked?' · tap to allow audio':unlocked?' · audio ready':' · enable audio';};
 // Photo and five Turkish recitations selected by the user.
 const assets={image:'https://images.unsplash.com/photo-1527838832700-5059252407fa?auto=format&fit=crop&w=1600&q=85',...(window.ADHAN_ASSETS||{})};
 const time=instant=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',hour:'numeric',minute:'2-digit'}).format(new Date(instant));
 const recordings={
  Fajr:{label:'Sabah · Sabâ',file:'saba-makamindasabah-ezan-abdulkadir-sehitoglu.mp3'},
  Dhuhr:{label:'Öğle · Uşşak',file:'Ogle_ezani.mp3'},
  Asr:{label:'İkindi · Hicaz',file:'hicaz-makamindaikindi-ezan-abdulkadir-sehitoglu.mp3'},
  Maghrib:{label:'Akşam · Segâh',file:'segah-makamindaaksam-ezan-abdulkadir-sehitoglu.mp3'},
  Isha:{label:'Yatsı · Rast',file:'rast-makaminda-yatsi-ezani.mp3'}
 };
 let activeSource='';
 function finishAutomatic(){activeAutomatic=null;if(!A.adhanPlaying)return;A.adhanPlaying=false;A.resetIdle();A.go('home');}
 function failed(error){
  unlocked=false;
  blocked=error?.name==='NotAllowedError';
  message=blocked?'The browser blocked automatic sound. Tap Enable & test audio on this device. Your prayer selections are still saved.':'The adhan recording could not start. Check the connection and volume, then tap Enable & test audio. Your prayer selections are still saved.';
 }
 function player(name='Dhuhr'){
  const url=assets.audio||'https://konyacami.com/ses_dosya/'+recordings[name].file;
  if(!audio){
   audio=new Audio(url);activeSource=url;audio.preload='auto';
   audio.addEventListener('ended',()=>{message=enabled?'Audio enabled for selected prayers.':'Preview finished. Enable audio for automatic playback.';status();finishAutomatic();});
   audio.addEventListener('error',()=>{
    if(activeAutomatic){remove(activeAutomatic.fired);firedMemory.delete(activeAutomatic.fired);}
    failed();status();finishAutomatic();
   });
  }else if(activeSource!==url){audio.pause();audio.src=url;activeSource=url;}
  else if(audio.error)audio.load();
  audio.muted=false;audio.volume=1;
  return audio;
 }
 // A stalled download must release the scheduler so a retry can run.
 function startAudio(p){return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{p.pause();reject(new Error('Audio startup timed out'));},15000);
  let result;try{result=p.play();}catch(error){clearTimeout(timer);reject(error);return;}
  Promise.resolve(result).then(()=>{clearTimeout(timer);resolve();},error=>{clearTimeout(timer);reject(error);});
 });}
 function firedKey(data,name){return 'frame-adhan-fired-'+data.date+'-'+name;}
 function wasFired(key){return firedMemory.has(key)||!!read(key);}
 function markFired(key){firedMemory.add(key);save(key,'played');}
 function showAutomatic(){A.adhanPlaying=true;A.resetIdle();A.closeSheet();A.setMode('day');A.go('adhan');}
 function render(){if(!view)return;const data=A.prayerData?.(),next=A.nextPrayer?.();view.innerHTML='<div class="adhan-page"><header class="adhan-head"><div><div class="label">A MOMENT FOR PRAYER</div><h1 class="serif">Adhan</h1></div><button class="btn btn--ghost" data-adhan-home>Back to Today</button></header><div class="adhan-layout"><figure class="adhan-image">'+(assets.image?'<img src="'+A.esc(assets.image)+'" alt="Sultanahmet Mosque in Istanbul">':'<div class="adhan-image-pending"><span aria-hidden="true">☾</span><h2 class="serif">Sultanahmet</h2><p>Istanbul, Türkiye</p><small>Photo will be added after verification.</small></div>')+'<figcaption>Sultanahmet Mosque · Istanbul<br><a href="https://unsplash.com/photos/kNSREmtaGOE" target="_blank" rel="noopener">Photo by Fatih Yürür · Unsplash</a></figcaption></figure><section class="adhan-panel"><div class="label">EAST GWILLIMBURY</div><h2 class="serif">'+(next?next.hours+' hr '+next.minutes+' min to '+next.name:'Daily prayer times')+'</h2><p class="adhan-location">Hanafi Asr · Toronto time</p><div class="adhan-times">'+names.map(name=>'<label class="adhan-prayer"><span><b>'+name+'</b><small>'+ (data?time(data.instants[name]):'Times unavailable')+'</small><small class="adhan-recording">'+recordings[name].label+'</small></span><span class="adhan-switch"><input type="checkbox" data-prayer="'+name+'" aria-label="Play adhan for '+name+'" '+(settings[name]?'checked':'')+'><span aria-hidden="true"></span></span></label>').join('')+'</div><div class="adhan-audio"><button class="btn btn--solid" data-adhan-enable>Enable & test audio</button><button class="btn btn--ghost" data-adhan-stop>Stop audio</button></div><p class="adhan-status" role="status">'+A.esc(message)+'</p><p class="adhan-help">Switch on the prayers you want to hear on this device. Keep the dashboard open and the device awake. Automatic playback stays selected after a refresh. Browsers may still require a fresh tap to allow sound; check the audio status beside Adhan on Today. Playback cannot run while the browser is suspended or the device is locked.</p><div class="adhan-previews"><div class="label">Preview each adhan</div>'+names.map(name=>'<button class="btn btn--ghost" data-adhan-preview="'+name+'">▶ '+recordings[name].label+'</button>').join('')+'</div></section></div><section class="adhan-about"><h2 class="serif">The call to prayer</h2><p>Each prayer has its own Turkish mosque-style recitation. Sabah uses its separate morning recording, including “Es-salâtü hayrun mine’n-nevm.” The adhan announces the beginning of a prayer time. These times use the same East Gwillimbury schedule shown on Today. Automatic playback runs only for the prayers you select, including while the dashboard screensaver is showing. When it starts, this page opens automatically and stays on screen until the recording finishes. Then the dashboard returns to Today.</p><p>Recordings: <a href="https://konyacami.com/cami-musikisi" target="_blank" rel="noopener">Konya Camilerini Temizleme Derneği · Câmi Mûsikîsi</a>.</p><p>Your choices stay on this device. Enable them on the tablet you want to hear.</p></section></div>';}
 async function enable(name='Dhuhr',automatic=true){
  const due=pendingPrayer&&Date.now()-pendingPrayer.at<=120000?pendingPrayer:null;
  if(automatic){enabled=true;save(enabledKey,'yes');blocked=false;if(due)name=due.name;}
  const p=player(name),generation=++playGeneration;
  try{
   p.currentTime=0;await startAudio(p);if(generation!==playGeneration)return;unlocked=true;blocked=false;
   if(automatic&&due){markFired(due.fired);activeAutomatic=due;pendingPrayer=null;showAutomatic();}
   message='Playing '+recordings[name].label+'. '+(enabled?'Audio is enabled for your selected prayers.':'Tap Enable & test audio to turn on automatic playback.');
  }catch(error){if(generation!==playGeneration)return;failed(error);}status();
 }
 function stop(){playGeneration++;if(pendingPrayer){firedMemory.add(pendingPrayer.fired);save(pendingPrayer.fired,'skipped');}if(audio){audio.pause();audio.currentTime=0;}pendingPrayer=null;message=enabled?'Audio enabled for selected prayers.':'Audio stopped.';status();finishAutomatic();}
 async function check(){
  if(checking||A.adhanPlaying||!enabled)return;
  const now=Date.now(),data=A.prayerData?.();if(!data)return;
  // Scan a short due window rather than losing the event after one timer tick, reload or network failure.
  const name=names.find(name=>settings[name]&&data.instants[name]<=now&&now-data.instants[name]<=120000&&!wasFired(firedKey(data,name)));
  if(!name)return;
  const fired=firedKey(data,name),at=data.instants[name];
  if(blocked||now-(attempts.get(fired)||0)<20000)return;
  checking=true;
  const play=async lock=>{
   if(lock===null||wasFired(fired)||Date.now()-at>120000)return;
   attempts.set(fired,Date.now());pendingPrayer={name,at,fired};const generation=++playGeneration;
   try{
    const p=player(name);p.currentTime=0;activeAutomatic={name,at,fired};await startAudio(p);if(generation!==playGeneration)return;
    markFired(fired);pendingPrayer=null;unlocked=true;blocked=false;message=name+' adhan is playing.';showAutomatic();
   }catch(error){
    if(generation!==playGeneration)return;activeAutomatic=null;failed(error);
    // Show a recoverable prompt instead of quietly consuming the prayer trigger.
    A.resetIdle();A.closeSheet();A.setMode('day');A.go('adhan');
   }status();
  };
  try{if(navigator.locks)await navigator.locks.request(fired,{ifAvailable:true},play);else await play();}
  catch{message='Audio scheduling could not run. Open Adhan and tap Enable & test audio.';status();}
  finally{checking=false;}
 }
 function mount(el){view=el;if(!el.dataset.adhanBound){el.dataset.adhanBound='yes';el.addEventListener('change',e=>{const name=e.target.dataset.prayer;if(!names.includes(name))return;settings[name]=e.target.checked;save(key,JSON.stringify(settings));status();});el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-adhan-home'))A.go('home');else if(b.hasAttribute('data-adhan-enable'))enable();else if(b.hasAttribute('data-adhan-stop'))stop();else if(names.includes(b.dataset.adhanPreview))enable(b.dataset.adhanPreview,false);});}render();}
 A.register('adhan',{show:mount,resume:mount,hide(){view=null;}});
 A.on('prayers',()=>{render();check();});A.on('second',check);
 window.addEventListener('online',check);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
})();
