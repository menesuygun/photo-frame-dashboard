(function(){
 const A=window.App,key='frame-eg-news-v1',source='https://www.eastgwillimbury.ca/Modules/News/en';
 let data=null,index=0,busy=false,failed=false,lastRotation=Date.now(),filter='all';
 function items(){return (data?.articles||[]).filter(item=>filter==='all'||filter==='town'&&item.source==='Town of East Gwillimbury'||filter==='police'&&item.kind==='police'||filter==='local'&&item.source==='NewmarketToday');}
 function valid(value){return value&&Array.isArray(value.articles)&&value.articles.length>0&&value.articles.length<=30&&value.articles.every(item=>{
  try{const url=new URL(item.url);return url.protocol==='https:'&&(url.hostname==='www.eastgwillimbury.ca'&&url.pathname.startsWith('/en/news/')||url.hostname==='www.yrp.ca'&&url.pathname.startsWith('/news/')||url.hostname==='www.newmarkettoday.ca'&&/^\/(local-news|police-beat)\//.test(url.pathname))&&typeof item.title==='string'&&item.title.length<=220&&typeof item.summary==='string'&&item.summary.length<=1200;}catch{return false;}
 });}
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(valid(saved)){data=saved;data.stale=true;}}catch{}
 function paint(){const root=document.querySelector('.eg-news-panel');if(root)root.innerHTML=panelContent();}
 function panelContent(){
  const list=items(),item=list[index%Math.max(1,list.length)];
  const date=item?.published&&/^\d{4}-\d{2}-\d{2}$/.test(item.published)?new Intl.DateTimeFormat('en-CA',{timeZone:'UTC',month:'long',day:'numeric',year:'numeric'}).format(new Date(item.published+'T12:00Z')):'';
  return '<nav class="eg-news-filters" aria-label="EG news sources">'+[['all','All updates'],['town','Town'],['police','Police'],['local','Local reporting']].map(([id,label])=>'<button data-eg-news-filter="'+id+'" aria-pressed="'+(filter===id)+'">'+label+'</button>').join('')+'</nav><article class="eg-news-feature"><header class="eg-news-head"><div class="eg-news-identity"><span class="eg-news-badge" aria-hidden="true">EG</span><div><div class="label">East Gwillimbury</div><span>Town, police & local coverage</span></div></div><button class="btn btn--ghost" data-eg-news-next aria-label="Next East Gwillimbury news story" '+(list.length<2?'disabled':'')+'>Next story '+A.icon('right',22)+'</button></header>'+(item?'<div class="eg-news-story"><h2>'+A.esc(item.title)+'</h2><p>'+A.esc(item.summary)+'</p></div><footer class="eg-news-meta"><span><a href="'+A.esc(item.url)+'" target="_blank" rel="noopener noreferrer">'+A.esc(item.source||'Town of East Gwillimbury')+'</a> · '+A.esc(date)+(data.stale||failed?' · Saved update':'')+'</span><span>Story '+(index%list.length+1)+' of '+list.length+'</span></footer>':'<a class="eg-news-empty" href="'+source+'" target="_blank" rel="noopener noreferrer">'+(data?'No recent East Gwillimbury updates from this source.':failed?'News temporarily unavailable. View Town news ↗':'Loading East Gwillimbury news…')+'</a>')+'</article>';
 }
 A.egNewsPanelHTML=function(){return '<section class="eg-news-panel" aria-label="East Gwillimbury news">'+panelContent()+'</section>';};
 async function refresh(){
  if(busy)return;lastRotation=Date.now();if(!navigator.onLine){failed=true;paint();return;}busy=true;
  try{const response=await fetch('/api/eg-news',{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error();const value=await response.json();if(!valid(value))throw Error();const current=items()[index%Math.max(1,items().length)]?.url;data=value;index=Math.max(0,items().findIndex(item=>item.url===current));failed=false;try{localStorage.setItem(key,JSON.stringify(data));}catch{}}
  catch{failed=true;}finally{busy=false;paint();}
 }
 function next(){const count=items().length;if(count>1){index=(index+1)%count;lastRotation=Date.now();paint();}}
 document.addEventListener('click',event=>{const choice=event.target.closest('[data-eg-news-filter]');if(choice){filter=choice.dataset.egNewsFilter;index=0;lastRotation=Date.now();paint();return;}if(event.target.closest('[data-eg-news-next]')){event.preventDefault();next();}});
 document.addEventListener('pointerdown',event=>{if(event.target.closest('.eg-news-panel'))lastRotation=Date.now();});
 A.refreshEGNews=refresh;
 A.on('ready',()=>{
  refresh();setInterval(()=>{if(!document.hidden&&A.current==='sports'&&document.querySelector('.eg-news-panel')&&A.mode==='day'&&Date.now()-lastRotation>=45000&&!document.activeElement?.closest('.eg-news-story'))next();},1000);
  setInterval(()=>{if(!document.hidden)refresh();},15*60000);
  window.addEventListener('online',refresh);
 });
})();
