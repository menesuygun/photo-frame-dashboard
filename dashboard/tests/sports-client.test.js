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
