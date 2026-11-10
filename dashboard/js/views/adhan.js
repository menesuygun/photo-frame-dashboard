// Prayer audio is a per-device choice so every family device does not sound together.
(function(){
 const A=window.App,names=['Fajr','Dhuhr','Asr','Maghrib','Isha'],key='frame-adhan-settings-v1';
 let view=null,settings={Fajr:false,Dhuhr:false,Asr:false,Maghrib:false,Isha:false},enabled=false,message='',audio=null;
 const enabledKey='frame-adhan-auto-enabled-v1',firedMemory=new Set(),attempts=new Map();
 const secularKey='frame-adhan-secular-mode-v1';
 let unlocked=false,blocked=false,checking=false,activeAutomatic=null,pendingPrayer=null,playGeneration=0,audioPhase='';
 function read(key){try{return localStorage.getItem(key);}catch{return null;}}
 function save(key,value){try{localStorage.setItem(key,value);}catch{}}
 function remove(key){try{localStorage.removeItem(key);}catch{}}
 let secularPreference=read(secularKey);
 const isSecular=()=>secularPreference==='yes';
 try{const saved=JSON.parse(localStorage.getItem(key)||'{}');for(const name of names)settings[name]=saved[name]===true;}catch{}
 // Restore the device's selected-prayer intent; browser playback permission is separate.
 enabled=read(enabledKey)==='yes'||(read(enabledKey)===null&&names.some(name=>settings[name]));
 if(enabled)save(enabledKey,'yes');
 const blockedMessage='The browser blocked automatic sound. Tap Enable & test audio on this device. Your prayer selections are still saved.';
 function initialMessage(){
  if(blocked)return blockedMessage;
  return enabled?'Automatic adhan is on for the prayers selected on this device.':'Tap Enable & test audio on this device before automatic playback.';
 }
 message=initialMessage();
 function status(){render();A.emit('adhan-status');}
 A.adhanAudioLabel=function(){if(isSecular())return ' · secular mode';if(!enabled||!names.some(name=>settings[name]))return '';return blocked?' · tap to allow audio':unlocked?' · audio ready':' · auto on';};
 A.isSecularMode=isSecular;
 A.secularModeSwitch=function(){
  return '<label class="secular-mode"><span><strong>Secular mode</strong><small>Silence adhan and Ezan Duası on this device.</small></span>'+
   '<span class="adhan-switch"><input type="checkbox" role="switch" aria-label="Secular mode" data-secular-mode'+(isSecular()?' checked':'')+'><span aria-hidden="true"></span></span></label>';
 };
 function applySecularPreference(value){
  if(value===secularPreference)return;
  secularPreference=value;
  if(isSecular())stop(false);
  else{message=initialMessage();status();}
 }
 A.setSecularMode=function(on){
  if(on===isSecular())return;
  const value=on?'yes':String(Date.now());
  save(secularKey,value);
  applySecularPreference(value);
 };
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
 const duaSource=assets.dua||'https://api.spreaker.com/download/episode/53209156/ezan_duasi.mp3';
 const duaTurkishSource=assets.duaTurkish||'/assets/ezan-duasi-tr.m4a';
 let activeSource='';
 function finishAutomatic(returnHome=true){activeAutomatic=null;if(!A.adhanPlaying)return;A.adhanPlaying=false;A.resetIdle();if(returnHome)A.go('home');}
 function failed(error){
  unlocked=false;
  blocked=error?.name==='NotAllowedError';
  message=blocked?blockedMessage:'The adhan recording could not start. Check the connection and volume, then tap Enable & test audio. Your prayer selections are still saved.';
 }
 function completeAudio(text){
  audioPhase='';
  message=text;
  finishAutomatic();
  status();
 }
 async function audioEnded(){
  if(isSecular()||!audio.ended)return;
  if(audioPhase==='dua-tr'){
   completeAudio(enabled?'Audio enabled for selected prayers.':'Preview finished. Enable audio for automatic playback.');
   return;
  }
  if(audioPhase!=='adhan'&&audioPhase!=='dua-ar')return;
  const turkish=audioPhase==='dua-ar';
  const generation=++playGeneration;
  audioPhase='';
  try{
   const p=player(turkish?duaTurkishSource:duaSource);
   p.currentTime=0;
   await startAudio(p,generation);
   if(generation!==playGeneration)return;
   audioPhase=turkish?'dua-tr':'dua-ar';
   message=turkish?'Playing the Turkish meaning of Ezan Duası.':'Playing Ezan Duası in Arabic.';
   status();
  }catch{
   if(generation===playGeneration)completeAudio('Ezan Duası could not play on this device.');
  }
 }
 function audioError(){
  if(audioPhase==='dua-ar'||audioPhase==='dua-tr'){completeAudio('Ezan Duası could not play on this device.');return;}
  if(audioPhase!=='adhan')return;
  if(activeAutomatic){remove(activeAutomatic.fired);firedMemory.delete(activeAutomatic.fired);}
  failed();
  completeAudio(message);
 }
 const adhanSource=name=>assets.audio||'https://konyacami.com/ses_dosya/'+recordings[name].file;
 function player(url){
  if(!audio){
   audio=new Audio(url);activeSource=url;audio.preload='auto';
   audio.addEventListener('ended',audioEnded);
   audio.addEventListener('error',audioError);
  }else if(activeSource!==url){audio.pause();audio.src=url;activeSource=url;}
  else if(audio.error)audio.load();
  audio.muted=false;audio.volume=1;
  return audio;
 }
 // A stalled download must release the scheduler so a retry can run.
 function startAudio(p,generation){return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{if(generation===playGeneration)p.pause();reject(new Error('Audio startup timed out'));},15000);
  let result;try{result=p.play();}catch(error){clearTimeout(timer);reject(error);return;}
  Promise.resolve(result).then(()=>{clearTimeout(timer);resolve();},error=>{clearTimeout(timer);reject(error);});
 });}
 function firedKey(data,name){return 'frame-adhan-fired-'+data.date+'-'+name;}
 function wasFired(key){return firedMemory.has(key)||!!read(key);}
 function markFired(key){firedMemory.add(key);save(key,'played');}
 function showAutomatic(){A.adhanPlaying=true;A.resetIdle();A.closeSheet();A.setMode('day');A.go('adhan');}
 function render(){if(!view)return;const data=A.prayerData?.(),next=A.nextPrayer?.();const audioDisabled=isSecular()?' disabled':'';view.innerHTML='<div class="adhan-page"><header class="adhan-head"><div><div class="label">A MOMENT FOR PRAYER</div><h1 class="serif">Adhan</h1></div><button class="btn btn--ghost" data-adhan-home>Back to Today</button></header><div class="adhan-layout"><figure class="adhan-image">'+(assets.image?'<img src="'+A.esc(assets.image)+'" alt="Sultanahmet Mosque in Istanbul">':'<div class="adhan-image-pending"><span aria-hidden="true">☾</span><h2 class="serif">Sultanahmet</h2><p>Istanbul, Türkiye</p><small>Photo will be added after verification.</small></div>')+'<figcaption>Sultanahmet Mosque · Istanbul<br><a href="https://unsplash.com/photos/kNSREmtaGOE" target="_blank" rel="noopener">Photo by Fatih Yürür · Unsplash</a></figcaption></figure><section class="adhan-panel"><div class="label">EAST GWILLIMBURY</div><h2 class="serif">'+(next?next.hours+' hr '+next.minutes+' min to '+next.name:'Daily prayer times')+'</h2><p class="adhan-location">Hanafi Asr · Toronto time</p>'+A.secularModeSwitch()+'<div class="adhan-times">'+names.map(name=>'<label class="adhan-prayer"><span><b>'+name+'</b><small>'+ (data?time(data.instants[name]):'Times unavailable')+'</small><small class="adhan-recording">'+recordings[name].label+'</small></span><span class="adhan-switch"><input type="checkbox" data-prayer="'+name+'" aria-label="Play adhan for '+name+'" '+(settings[name]?'checked':'')+'><span aria-hidden="true"></span></span></label>').join('')+'</div><div class="adhan-audio"><button class="btn btn--solid" data-adhan-enable'+audioDisabled+'>Enable & test audio</button><button class="btn btn--ghost" data-adhan-stop'+audioDisabled+'>Stop audio</button></div><p class="adhan-status" role="status">'+A.esc(isSecular()?'Secular mode is on. Turn it off to hear adhan and Ezan Duası.':message)+'</p><p class="adhan-help">Switch on the prayers you want to hear on this device. Keep the dashboard open and the device awake. Automatic playback stays on after a refresh. If your browser blocks sound, Today will show “tap to allow audio.” Playback cannot run while the browser is suspended or the device is locked.</p><div class="adhan-previews"><div class="label">Preview each adhan</div>'+names.map(name=>'<button class="btn btn--ghost" data-adhan-preview="'+name+'"'+audioDisabled+'>▶ '+recordings[name].label+'</button>').join('')+'</div></section></div><section class="adhan-about"><h2 class="serif">The call to prayer</h2><p>Each prayer has its own Turkish mosque-style recitation. Sabah uses its separate morning recording, including “Es-salâtü hayrun mine’n-nevm.” The adhan announces the beginning of a prayer time. These times use the same East Gwillimbury schedule shown on Today. Automatic playback runs only for the prayers you select, including while the dashboard screensaver is showing. When it starts, this page opens automatically. After the adhan, Ezan Duası plays in Arabic, followed by its spoken Turkish meaning. The dashboard then returns to Today.</p><p>Recordings: <a href="https://konyacami.com/cami-musikisi" target="_blank" rel="noopener">Konya Camilerini Temizleme Derneği · Câmi Mûsikîsi</a> and <a href="https://www.spreaker.com/episode/ezan-duasi--53209156" target="_blank" rel="noopener">Diyanet Dijital · Ezan Duası</a>.</p><p>Your choices stay on this device. Enable them on the tablet you want to hear.</p></section></div>';}
 async function enable(name='Dhuhr',automatic=true){
  if(isSecular()||A.adhanPlaying)return;
  const due=pendingPrayer&&settings[pendingPrayer.name]&&Date.now()-pendingPrayer.at<=120000?pendingPrayer:null;
  if(automatic){enabled=true;save(enabledKey,'yes');blocked=false;if(due)name=due.name;}
  const generation=++playGeneration;
  audioPhase='';
  try{
   const p=player(adhanSource(name));
   p.currentTime=0;await startAudio(p,generation);if(generation!==playGeneration)return;
   audioPhase='adhan';unlocked=true;blocked=false;
   if(automatic&&due){markFired(due.fired);activeAutomatic=due;pendingPrayer=null;showAutomatic();}
   message='Playing '+recordings[name].label+'. '+(enabled?'Audio is enabled for your selected prayers.':'Tap Enable & test audio to turn on automatic playback.');
  }catch(error){if(generation!==playGeneration)return;failed(error);}status();
 }
 function stop(returnHome=true){
  playGeneration++;
  audioPhase='';
  if(pendingPrayer){firedMemory.add(pendingPrayer.fired);save(pendingPrayer.fired,'skipped');}
  pendingPrayer=null;
  if(audio){audio.pause();audio.currentTime=0;}
  message=enabled?'Audio enabled for selected prayers.':'Audio stopped.';
  finishAutomatic(returnHome);
  status();
 }
 async function check(){
  if(checking||A.adhanPlaying||isSecular()||!enabled)return;
  const now=Date.now(),data=A.prayerData?.();if(!data)return;
  const resumedAt=Number(secularPreference)||0;
  // Scan a short due window rather than losing the event after one timer tick, reload or network failure.
  const name=names.find(name=>settings[name]&&data.instants[name]>resumedAt&&data.instants[name]<=now&&now-data.instants[name]<=120000&&!wasFired(firedKey(data,name)));
  if(!name)return;
  const fired=firedKey(data,name),at=data.instants[name];
  if(blocked||now-(attempts.get(fired)||0)<20000)return;
  checking=true;
  const play=async lock=>{
   if(lock===null||isSecular()||at<=(Number(secularPreference)||0)||wasFired(fired)||Date.now()-at>120000)return;
   attempts.set(fired,Date.now());pendingPrayer={name,at,fired};const generation=++playGeneration;
   audioPhase='';
   try{
    const p=player(adhanSource(name));p.currentTime=0;await startAudio(p,generation);if(generation!==playGeneration)return;
    audioPhase='adhan';activeAutomatic={name,at,fired};
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
 function mount(el){view=el;if(!el.dataset.adhanBound){el.dataset.adhanBound='yes';el.addEventListener('change',e=>{if(e.target.hasAttribute('data-secular-mode')){
   A.setSecularMode(e.target.checked);
   el.querySelector('[data-secular-mode]').focus({preventScroll:true});
   return;
  }
  const name=e.target.dataset.prayer;if(!names.includes(name))return;settings[name]=e.target.checked;save(key,JSON.stringify(settings));status();});el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-adhan-home'))A.go('home');else if(b.hasAttribute('data-adhan-enable'))enable();else if(b.hasAttribute('data-adhan-stop'))stop();else if(names.includes(b.dataset.adhanPreview))enable(b.dataset.adhanPreview,false);});}render();}
 A.register('adhan',{show:mount,resume:mount,hide(){view=null;}});
 A.on('prayers',()=>{render();check();});A.on('second',check);
 window.addEventListener('online',check);
 window.addEventListener('storage',event=>{if(event.key===secularKey)applySecularPreference(event.newValue);});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
})();
