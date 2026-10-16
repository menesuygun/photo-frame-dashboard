import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/meal-plan.js',import.meta.url),'utf8');
function preview(meals){const App={choreDate:()=> '2026-10-16',now:()=>new Date('2026-10-16T12:00:00Z'),on(){},esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')};vm.runInNewContext(source,{window:{App,addEventListener(){}},localStorage:{getItem:()=>JSON.stringify(meals)}});return App.mealsTodayHTML();}
test('Today hides unplanned meals, filters by date and orders breakfast before dinner',()=>{
 assert.equal(preview([]),'');assert.equal(preview([{id:'x',name:'Tomorrow',date:'2026-10-23',type:'dinner'}]),'');
 const html=preview([{id:'d',name:'Chicken',date:'2026-10-16',type:'dinner'},{id:'b',name:'Toast',date:'2026-10-16',type:'breakfast'}]);assert.ok(html.indexOf('Toast')<html.indexOf('Chicken'));assert.match(html,/Meal illustration/);
});
test('meal names are escaped and stored photos must be local JPEG data',()=>{const base={id:'m',name:'<img src=x>',date:'2026-10-16',type:'lunch'};assert.match(preview([base]),/&lt;img/);assert.equal(preview([{...base,photo:'https://tracker.example/a.jpg'}]),'');assert.match(preview([{...base,photo:'data:image/jpeg;base64,AA=='}]),/class="meal-photo"/);});

test('next seven days group meals under each date and exclude day eight',()=>{
 const html=preview([{id:'a',name:'Breakfast today',date:'2026-10-16',type:'breakfast'},{id:'b',name:'Dinner today',date:'2026-10-16',type:'dinner'},{id:'c',name:'Last day',date:'2026-10-22',type:'lunch'},{id:'d',name:'Outside week',date:'2026-10-23',type:'dinner'}]);
 assert.equal((html.match(/class="meal-day-group"/g)||[]).length,2);assert.match(html,/Last day/);assert.doesNotMatch(html,/Outside week/);assert.ok(html.indexOf('Breakfast today')<html.indexOf('Dinner today'));
});
test('planner arrows navigate Monday–Sunday weeks across year boundaries',()=>{
 const App={choreDate:()=> '2026-12-31',now:()=>new Date(),on(){},esc:String};
 vm.runInNewContext(source,{window:{App,addEventListener(){}},localStorage:{getItem:()=> '[]'},Date,Intl});
 const panel={innerHTML:''};App.mountMealPlan(panel);
 assert.match(panel.innerHTML,/Mon, Dec 28/);assert.match(panel.innerHTML,/Sun, Jan 3/);
 const click=attributes=>panel.onclick({target:{closest:()=>({dataset:attributes,hasAttribute:k=>k==='data-meal-week'?'mealWeek' in attributes:k==='data-meal-this-week'?'thisWeek' in attributes:false})}});
 click({mealWeek:'1'});assert.match(panel.innerHTML,/Mon, Jan 4/);assert.match(panel.innerHTML,/Sun, Jan 10/);
 click({mealWeek:'-1'});assert.match(panel.innerHTML,/Mon, Dec 28/);
 click({mealWeek:'-1'});assert.match(panel.innerHTML,/Mon, Dec 21/);
 click({thisWeek:true});assert.match(panel.innerHTML,/Mon, Dec 28/);
});
