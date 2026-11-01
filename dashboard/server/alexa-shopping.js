import {createHash} from 'node:crypto';
import {supabase,validateDocument} from './household.js';
export const stores={grocer:'Grocery Store',costco:'Costco',other:'Other'};
const numbers={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,dozen:12};
export class ShoppingInputError extends Error {}
export function parseItem(spoken){
 let name=String(spoken||'').trim().replace(/\s+/g,' '),store='grocer',qty=1;
 const destination=name.match(/\s+(?:to|for|from|at)\s+(?:my\s+|the\s+)?(costco|grocery store|grocery|other|hardware store)(?:\s+(?:shopping\s+)?list)?[.!?]?$/i);
 if(destination){store=/costco/i.test(destination[1])?'costco':/other|hardware/i.test(destination[1])?'other':'grocer';name=name.slice(0,destination.index).trim();}
 name=name.replace(/\s+to\s+(?:my\s+|the\s+)?(?:shopping|grocery)\s+list[.!?]?$/i,'').replace(/[.!?]+$/,'').trim();
 const count=name.match(/^(\d+|a dozen|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen)\s+(.+)$/i);
 if(count){qty=count[1].toLowerCase()==='a dozen'?12:numbers[count[1].toLowerCase()]??Number(count[1]);name=count[2].trim();}
 if(!name||name.length>120||/[\u0000-\u001f]/.test(name)||!Number.isSafeInteger(qty)||qty<1||qty>99)throw new ShoppingInputError('Say one item with a quantity between one and ninety nine. For example, add two eggs to Costco.');
 return {name:name.charAt(0).toUpperCase()+name.slice(1),qty,store};
}
function category(name){
 const rules=[
  ['Meat & Deli',/\b(?:sujuk|sucuk|sudjuk|sausage|chicken|beef|steak|turkey|salmon|fish|bacon|ham|lamb|meat)\b/i],
  ['Dairy & Eggs',/\b(?:milk|eggs?|cheese|yogurt|yoghurt|butter|cream)\b/i],
  ['Produce',/\b(?:apples?|bananas?|oranges?|tomatoes?|potatoes?|onions?|carrots?|lettuce|spinach|broccoli|avocados?|berries|lemons?|cucumbers?)\b/i],
  ['Bakery',/\b(?:bread|bagels?|buns?|croissants?|tortillas?)\b/i],
  ['Frozen',/\b(?:frozen|ice cream)\b/i],
  ['Snacks',/\b(?:chips|crackers|popcorn|chocolate|cookies|granola bars?)\b/i],
  ['Household',/\b(?:laundry|detergent|soap|paper towels?|toilet paper|dishwasher|cleaner|garbage bags?)\b/i],
  ['Hardware & DIY',/\b(?:screws?|nails?|paint|drill|hammer|light bulbs?|batteries|tape)\b/i],
  ['Pantry',/\b(?:rice|pasta|flour|sugar|salt|oil|beans|lentils|coffee|tea|cereal|sauce|spices?)\b/i]
 ];
 return rules.find(([,pattern])=>pattern.test(name))?.[0]||'Other';
}
const normalize=s=>s.normalize('NFKC').trim().toLowerCase();
export async function addItem(item,requestId){
 const receipt=createHash('sha256').update(requestId).digest('hex');
 const household=process.env.HOUSEHOLD_ID,deadline=Date.now()+4500;
 const fetcher=(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(Math.max(1,deadline-Date.now()))});
 for(let attempt=0;attempt<4&&Date.now()<deadline;attempt++){
  const rows=await supabase('/rest/v1/household_documents?household=eq.'+encodeURIComponent(household)+'&category=eq.shopping&select=value,revision',{},fetcher);
  if(!rows.length)throw new ShoppingInputError('Import your household in Family sync before using Alexa.');
  const row=rows[0],list=structuredClone(row.value);
  if(!validateDocument('shopping',list))throw Error('Invalid shared list');
  // Keep recent delivery IDs with the item so a retry does not increase its quantity again.
  if(list.some(entry=>Array.isArray(entry.alexaRequests)&&entry.alexaRequests.includes(receipt)))return item;
  const match=list.find(entry=>entry.store===item.store&&normalize(entry.name)===normalize(item.name));
  if(match){
   match.qty=(match.done?0:match.qty)+item.qty;match.done=false;
   if(match.qty>999)throw new ShoppingInputError('That would exceed nine hundred ninety nine. Change the quantity in your dashboard.');
   match.alexaRequests=[...(Array.isArray(match.alexaRequests)?match.alexaRequests:[]),receipt].slice(-64);
  }else{
   if(list.length>=500)throw new ShoppingInputError('Your shopping list is full. Remove some items in the dashboard first.');
   list.push({id:'g-alexa-'+receipt.slice(0,32),name:item.name,qty:item.qty,store:item.store,cat:category(item.name),done:false,note:'',alexaRequests:[receipt]});
  }
  if(!validateDocument('shopping',list))throw new ShoppingInputError('Please try a shorter item name.');
  const saved=await supabase('/rest/v1/rpc/save_household_document',{method:'POST',body:{p_household:household,p_category:'shopping',p_value:list,p_expected:row.revision}},fetcher);
  if(saved.length)return item;
 }
 throw Error('Shopping list busy');
}
