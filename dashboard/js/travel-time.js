(function(){
 'use strict';
 var A=window.App,D=window.DATA,cache={},busy={};
 A.travelState={};
 var REFRESH_MS=30*60*1000;
 function eligible(e){return e&&!e.allDay&&e.loc&&e.start>A.now()&&e.start-A.now()<=86400000&&!/https?:|zoom|teams\.microsoft|online|virtual/i.test(e.loc);}
 function apply(e,data){if(data.error||!Number.isFinite(data.minutes)||!data.checkedAt||Date.now()-new Date(data.checkedAt)>=REFRESH_MS){delete e.travel;A.travelState[e.id]={status:'error',error:data.error||'route-unavailable'};return;}e.travel=data.minutes;A.travelState[e.id]={status:'ready',...data};}
 A.requestTravel=function(e){
   if(!eligible(e)||!A.calendarSync||(!e.dashboardEvent&&!['ready','stale'].includes(A.calendarSync.status)))return Promise.resolve();
   var id=e.id,stamp=e.start.toISOString()+'|'+e.loc,entry=cache[id];
   if(entry&&entry.stamp===stamp&&Date.now()-(entry.data.checkedAt?new Date(entry.data.checkedAt).getTime():entry.at)<REFRESH_MS){apply(e,entry.data);return Promise.resolve();}
   if(busy[id])return busy[id];A.travelState[id]={status:'loading'};
   var code='';try{code=localStorage.getItem('frame-calendar-code')||'';}catch(_){}
   busy[id]=fetch('/api/travel?event='+encodeURIComponent(id),{headers:{Authorization:'Bearer '+code},cache:'no-store'}).then(function(r){return r.json();}).then(function(data){cache[id]={stamp:stamp,at:Date.now(),data:data};var current=A.findEvent?A.findEvent(id):D.events.find(function(x){return x.id===id;});if(current&&current.start.toISOString()+'|'+current.loc===stamp){apply(current,data);if(current!==e)apply(e,data);}}).catch(function(){apply(e,{error:'route-unavailable'});}).finally(function(){delete busy[id];A.emit('travel');});
   return busy[id];
 };
 function update(){return A.requestTravel(A.nextEvent());}
 A.eventTravelHTML=function(e){
   if(e.allDay||e.start<=A.now())return '';
   var content='';
   if(!e.loc||/https?:|zoom|teams\.microsoft|online|virtual/i.test(e.loc))content='<b>Driving time</b><span>Add a destination address to the calendar Location field.</span>';
   else if(e.start-A.now()>86400000)content='<b>Leave by</b><span>Traffic estimate available within 24 hours of this event.</span>';
   else {var state=A.travelState[e.id];if(state&&state.status==='ready'&&e.travel)content='<b>Leave by '+A.fmt.time(A.leaveBy(e))+'</b><span>'+e.travel+' min drive · Google Maps traffic estimate'+(A.leaveBy(e)<=A.now()?' · Leave now':'')+'</span>';else content='<b>Leave by</b><span>'+(state&&state.status==='error'?'Driving time unavailable. Check the destination address or try again later.':'Checking traffic…')+'</span>';}
   return '<div class="evs-row evs-leave">'+A.icon('car',28)+'<div>'+content+'</div></div>';
 };
 A.on('data',update);A.on('minute',update);A.on('ready',function(){setInterval(update,60000);});
})();
