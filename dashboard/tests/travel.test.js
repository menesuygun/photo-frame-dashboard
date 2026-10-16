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
