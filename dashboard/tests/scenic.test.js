import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const source=f=>fs.readFileSync(new URL('../js/'+f,import.meta.url),'utf8');
test('screensaver uses its own scenic collection even when personal photos change',()=>{
 const events={};const App={on:(n,f)=>events[n]=f,photoMeta:()=>({}),esc:String};const context={window:{DATA:{photos:[{id:'personal'}]},App},App,Math,Date,Object,clearInterval(){},setInterval(){}};
 vm.createContext(context);vm.runInContext(source('scenic-photos.js'),context);vm.runInContext(source('slideshow.js'),context);
 const show=new App.Slideshow({}, {layout:'cover',photos:App.scenicPhotos});const picked=show.pick();assert.ok(picked.photos[0].url.startsWith('https://images.unsplash.com/'));assert.notEqual(picked.photos[0].id,'personal');show.current=picked;events.photos();assert.equal(show.current,picked);
 for(const place of ['Antalya','Istanbul','Toronto','Alberta','British Columbia','Québec'])assert.ok(App.scenicPhotos.some(p=>p.place.includes(place)));
});
test('idle starts scenic mode at 120 seconds on Education and at night',()=>{
 const text=source('app.js');const idle=text.slice(text.indexOf('  App.idle ='),text.indexOf('  App.resetIdle ='));
 for(const current of ['home','education']){const modes=[];const App={current,mode:'day',closeSheet(){},go(){},isNight:()=>true,setMode:m=>modes.push(m)};const c={App,$:()=>({classList:{contains:()=>false}})};vm.createContext(c);vm.runInContext(idle,c);for(let i=0;i<119;i++)vm.runInContext('onIdleTick()',c);assert.equal(modes.length,0);vm.runInContext('onIdleTick()',c);assert.deepEqual(modes,['ambient']);}
});
