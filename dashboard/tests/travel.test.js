import test from 'node:test';import assert from 'node:assert/strict';
import {drivingEstimate} from '../server/travel.js';import handler from '../api/travel.js';
test('traffic estimates refine departure time and round driving minutes up',async()=>{
 const calls=[];const result=await drivingEstimate({origin:'Home',destination:'Venue',start:'2026-10-16T18:00:00Z',now:new Date('2026-10-16T16:00:00Z'),key:'test-only',fetcher:async(url,options)=>{calls.push({url,...options,body:JSON.parse(options.body)});return {ok:true,json:async()=>({routes:[{duration:calls.length===1?'1801s':'2101s'}]})};}});
 assert.equal(result.minutes,36);assert.equal(result.leaveBy,'2026-10-16T17:24:00.000Z');assert.equal(calls.length,2);assert.equal(calls[1].body.departureTime,'2026-10-16T17:29:00.000Z');assert.equal(calls[0].body.routingPreference,'TRAFFIC_AWARE_OPTIMAL');assert.equal(calls[0].body.trafficModel,'BEST_GUESS');assert.equal(calls[0].headers['X-Goog-Api-Key'],'test-only');
});
test('traffic errors, partial addresses and absent routes never invent a driving time',async()=>{
 for(const payload of [{fallbackInfo:{}},{routes:[]},{geocodingResults:{destination:{partialMatch:true}},routes:[{duration:'900s'}]}])await assert.rejects(()=>drivingEstimate({origin:'Home',destination:'Venue',start:'2026-10-17T18:00:00Z',now:new Date('2026-10-16T18:00:00Z'),key:'test-only',fetcher:async()=>({ok:true,json:async()=>payload})}));
 await assert.rejects(()=>drivingEstimate({origin:'Home',destination:'Venue',start:'2026-10-17T18:00:00Z',now:new Date('2026-10-16T18:00:00Z'),key:'test-only',fetcher:async()=>({ok:false,status:403,json:async()=>({error:{details:[{reason:'SERVICE_DISABLED'}]}})})}),/routes-disabled/);
});
test('travel API rejects access without the frame code before any routing request',async()=>{
 const old=process.env.FRAME_ACCESS_CODE;process.env.FRAME_ACCESS_CODE='testing-code';const response={setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};
 try{await handler({method:'GET',headers:{},query:{event:'a'.repeat(64)}},response);assert.equal(response.code,401);assert.equal(response.data.error,'unlock-calendar');}finally{if(old===undefined)delete process.env.FRAME_ACCESS_CODE;else process.env.FRAME_ACCESS_CODE=old;}
});

import vm from 'node:vm';import fs from 'node:fs';
test('clicked event fetches traffic on demand, shares an in-flight request and reuses it for 30 minutes',async()=>{
 const now=new Date();const e={id:'event',loc:'Venue',start:new Date(+now+3600000)};let calls=0,release;
 const App={calendarSync:{status:'ready'},on(){},now:()=>now,nextEvent:()=>null,emit(){},fmt:{time:()=> '1:00 PM'},leaveBy:x=>new Date(+x.start-x.travel*60000),icon:()=>''};
 const context={window:{App,DATA:{events:[e]}},Date,Number,Promise,setInterval(){},localStorage:{getItem:()=> 'code'},fetch:()=>{calls++;return new Promise(resolve=>release=()=>resolve({json:async()=>({minutes:12,checkedAt:new Date().toISOString()})}));}};
 vm.runInNewContext(fs.readFileSync(new URL('../js/travel-time.js',import.meta.url),'utf8'),context);
 const first=App.requestTravel(e),second=App.requestTravel(e);assert.equal(calls,1);assert.equal(first,second);release();await first;assert.equal(e.travel,12);await App.requestTravel(e);assert.equal(calls,1);assert.match(App.eventTravelHTML(e),/Leave by 1:00 PM/);
 const distant={...e,id:'later',start:new Date(+now+2*86400000)};await App.requestTravel(distant);assert.equal(calls,1);assert.match(App.eventTravelHTML(distant),/within 24 hours/);
 assert.match(App.eventTravelHTML({...e,loc:''}),/Add a destination/);
});

test('traffic cache refreshes at 30 minutes, not at five minutes',async()=>{
 let stamp=Date.now(),calls=0;const initial=stamp;class Clock extends Date{constructor(...args){super(...(args.length?args:[stamp]));}static now(){return stamp;}}
 const e={id:'event',loc:'Venue',start:new Clock(initial+3*3600000)};const App={calendarSync:{status:'ready'},on(){},now:()=>new Clock(),nextEvent:()=>e,emit(){}};
 vm.runInNewContext(fs.readFileSync(new URL('../js/travel-time.js',import.meta.url),'utf8'),{window:{App,DATA:{events:[e]}},Date:Clock,Number,Promise,setInterval(){},localStorage:{getItem:()=> 'code'},fetch:async()=>{calls++;return {json:async()=>({minutes:12,checkedAt:new Clock().toISOString()})};}});
 await App.requestTravel(e);assert.equal(calls,1);stamp=initial+29*60000;await App.requestTravel(e);assert.equal(calls,1);assert.equal(e.travel,12);stamp=initial+30*60000;await App.requestTravel(e);assert.equal(calls,2);
});
