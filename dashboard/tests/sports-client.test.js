import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('returning to cached Sports reconnects controls and preserves scroll through updates',()=>{
 let sports,click;const container={scrollTop:180},el={dataset:{},innerHTML:'',querySelector:()=>container,addEventListener:(name,fn)=>{click=fn;}};
 const App={esc:String,on(){},register(name,v){sports=v;}};
 vm.runInNewContext(fs.readFileSync(new URL('../js/views/sports.js',import.meta.url),'utf8'),{window:{App},Intl,Date,document:{querySelector:()=>null},AbortSignal,fetch:()=>new Promise(()=>{}),setInterval(){}});
 sports.show(el);sports.hide();sports.resume(el);
 click({target:{closest:()=>({dataset:{sportTab:'standings'}})}});
 assert.match(el.innerHTML,/data-sport-tab="standings" aria-pressed="true"/);
 assert.equal(container.scrollTop,180);
 sports.hide();sports.resume(el);click({target:{closest:()=>({dataset:{sportTab:'news'}})}});
 assert.match(el.innerHTML,/data-sport-tab="news" aria-pressed="true"/);
});

test('banner prioritizes Galatasaray live score and today final over upcoming fixture',async()=>{
 for(const state of ['in','post']){
  let sports;const el={dataset:{},innerHTML:'',querySelector:()=>null,addEventListener(){}};
  const match={id:'today',date:new Date().toISOString(),competition:'Süper Lig',home:{id:'432',name:'Galatasaray',score:'0'},away:{id:'other',name:'Opponent',score:'2'},state,status:'FT',clock:"73'"};
  const upcoming={...match,id:'future',date:new Date(Date.now()+86400000).toISOString(),state:'pre'};
  const data={scores:{data:[match]},galatasaray:{data:[upcoming]}};
  const App={esc:String,on(){},register(n,v){sports=v;}};
  vm.runInNewContext(fs.readFileSync(new URL('../js/views/sports.js',import.meta.url),'utf8'),{window:{App},Intl,Date,document:{querySelector:()=>null},AbortSignal,fetch:async()=>({ok:true,json:async()=>({result:data})}),setInterval(){}});
  sports.show(el);await new Promise(resolve=>setImmediate(resolve));
  assert.match(el.innerHTML,/sp-banner-score">0 – 2/);
  assert.match(el.innerHTML,state==='in'?/LIVE · 73'/ : /FULL TIME/);
 }
});
