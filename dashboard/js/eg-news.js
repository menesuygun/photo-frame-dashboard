(function(){
 const A=window.App,key='frame-eg-news-v1',source='https://www.eastgwillimbury.ca/Modules/News/en';
 let data=null,index=0,busy=false,failed=false,lastRotation=Date.now();
 function valid(value){return value&&Array.isArray(value.articles)&&value.articles.length>0&&value.articles.length<=10&&value.articles.every(item=>{
  try{const url=new URL(item.url);return url.protocol==='https:'&&url.hostname==='www.eastgwillimbury.ca'&&url.pathname.startsWith('/en/news/')&&typeof item.title==='string'&&item.title.length<=220&&typeof item.summary==='string'&&item.summary.length<=600;}catch{return false;}
 });}
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(valid(saved)){data=saved;data.stale=true;}}catch{}
 function paint(){const root=document.querySelector('.h-news');if(root)root.innerHTML=A.egNewsHTML();}
 A.egNewsHTML=function(){
  const items=data?.articles||[],item=items[index%Math.max(1,items.length)];
  const date=item?.published&&/^\d{4}-\d{2}-\d{2}$/.test(item.published)?new Intl.DateTimeFormat('en-CA',{timeZone:'UTC',month:'short',day:'numeric'}).format(new Date(item.published+'T12:00Z')):'';
  return '<div class="h-news-head"><span class="label">EG News</span><button class="h-news-next" data-eg-news-next aria-label="Next East Gwillimbury news story" '+(items.length<2?'disabled':'')+'>'+A.icon('right',20)+'</button></div>'+(item?'<a class="h-news-story" href="'+A.esc(item.url)+'" target="_blank" rel="noopener noreferrer"><h3>'+A.esc(item.title)+'</h3><p>'+A.esc(item.summary)+'</p></a><div class="h-news-foot"><span>'+A.esc(date)+(data.stale||failed?' · Saved update':'')+'</span><span>'+(index%items.length+1)+' / '+items.length+'</span></div>':'<a class="h-news-empty" href="'+source+'" target="_blank" rel="noopener noreferrer">'+(failed?'News temporarily unavailable. View Town news ↗':'Loading Town news…')+'</a>');
 };
 async function refresh(){
  if(busy)return;if(!navigator.onLine){failed=true;paint();return;}busy=true;
  try{const response=await fetch('/api/eg-news',{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error();const value=await response.json();if(!valid(value))throw Error();const current=data?.articles[index%data.articles.length]?.url;data=value;index=Math.max(0,data.articles.findIndex(item=>item.url===current));failed=false;try{localStorage.setItem(key,JSON.stringify(data));}catch{}}
  catch{failed=true;}finally{busy=false;paint();}
 }
 function next(){const count=data?.articles.length||0;if(count>1){index=(index+1)%count;lastRotation=Date.now();paint();}}
 document.addEventListener('click',event=>{if(event.target.closest('[data-eg-news-next]')){event.preventDefault();next();}});
 document.addEventListener('pointerdown',event=>{if(event.target.closest('.h-news'))lastRotation=Date.now();});
 A.on('ready',()=>{
  refresh();setInterval(()=>{if(!document.hidden&&A.current==='home'&&A.mode==='day'&&Date.now()-lastRotation>=45000&&!document.activeElement?.closest('.h-news-story'))next();},1000);
  setInterval(()=>{if(!document.hidden)refresh();},15*60000);
  window.addEventListener('online',refresh);
 });
})();
