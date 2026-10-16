(function(){
 'use strict';
 var A=window.App,D=window.DATA,cache={},busy={};
 A.travelState={};
 function update(){
   if(!A.calendarSync||!['ready','stale'].includes(A.calendarSync.status))return;
   var e=A.nextEvent();if(!e||!e.loc)return;
   var id=e.id,stamp=e.start.toISOString()+'|'+e.loc,entry=cache[id];
   if(entry&&entry.stamp===stamp&&Date.now()-entry.at<300000){apply(e,entry.data);return;}
   if(busy[id])return;busy[id]=true;A.travelState[id]={status:'loading'};
   var code='';try{code=localStorage.getItem('frame-calendar-code')||'';}catch(_){}
   fetch('/api/travel?event='+encodeURIComponent(id),{headers:{Authorization:'Bearer '+code},cache:'no-store'}).then(function(r){return r.json();}).then(function(data){cache[id]={stamp:stamp,at:Date.now(),data:data};var current=D.events.find(function(x){return x.id===id;});if(current&&current.start.toISOString()+'|'+current.loc===stamp)apply(current,data);}).catch(function(){apply(e,{error:'route-unavailable'});}).finally(function(){delete busy[id];A.emit('travel');});
 }
 function apply(e,data){if(data.error||!Number.isFinite(data.minutes)||Date.now()-new Date(data.checkedAt)>600000){delete e.travel;A.travelState[e.id]={status:'error',error:data.error||'route-unavailable'};return;}e.travel=data.minutes;A.travelState[e.id]={status:'ready',...data};}
 A.on('data',update);A.on('minute',update);A.on('ready',function(){setInterval(update,60000);});
})();
