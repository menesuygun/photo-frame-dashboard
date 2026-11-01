import alexaVerification from 'ask-sdk-express-adapter';
import {authorized,configured} from '../server/household.js';
import {addItem,parseItem,stores,ShoppingInputError} from '../server/alexa-shopping.js';
const {SkillRequestSignatureVerifier,TimestampVerifier}=alexaVerification;
const signatureVerifier=new SkillRequestSignatureVerifier(),timestampVerifier=new TimestampVerifier();
const headers={'Cache-Control':'private, no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
function say(text,end=true){return json({version:'1.0',response:{outputSpeech:{type:'PlainText',text},shouldEndSession:end,...(!end?{reprompt:{outputSpeech:{type:'PlainText',text:'Say add milk, or add two eggs to Costco.'}}}:{})}});}
async function rawBody(request){
 const reader=request.body?.getReader();if(!reader)return '';
 const parts=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw Error('Too large');}parts.push(Buffer.from(value));}}finally{reader.releaseLock();}
 return Buffer.concat(parts).toString('utf8');
}
export default {async fetch(request){
 if(request.method==='GET'){
  if(!authorized({headers:{authorization:request.headers.get('authorization')}}))return json({error:'Connect this device with your frame code first.'},401);
  return json({skillConfigured:!!process.env.ALEXA_SKILL_ID,accountConfigured:!!process.env.ALEXA_ALLOWED_USER_ID,storageConfigured:configured()});
 }
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(!process.env.ALEXA_SKILL_ID)return json({error:'Alexa skill setup is not finished.'},503);
 let envelope;
 try{
  const raw=await rawBody(request);
  await timestampVerifier.verify(raw);
  await signatureVerifier.verify(raw,Object.fromEntries(request.headers));
  envelope=JSON.parse(raw);
 }catch{return json({error:'Invalid Alexa request'},400);}
 const system=envelope.context?.System,session=envelope.session;
 const applicationIds=[system?.application?.applicationId,session?.application?.applicationId].filter(Boolean);
 if(!applicationIds.length||applicationIds.some(id=>id!==process.env.ALEXA_SKILL_ID))return json({error:'Skill not authorized'},403);
 const type=envelope.request?.type;
 if(type==='SessionEndedRequest')return json({version:'1.0',response:{}});
 // Keep launch/help usable during setup, but never grant shopping access before the account is restricted.
 if(!process.env.ALEXA_ALLOWED_USER_ID)return say('Family Frame needs one more setup step. Save your Alexa user ID in the dashboard hosting settings. No shopping items have been changed.');
 const userIds=[system?.user?.userId,session?.user?.userId].filter(Boolean);
 if(!userIds.length||userIds.some(id=>id!==process.env.ALEXA_ALLOWED_USER_ID))return say('This Amazon account is not connected to Family Frame.');
 if(type==='LaunchRequest')return say('Welcome to Family Frame. Say add milk, or add two eggs to Costco.',false);
 if(type!=='IntentRequest')return say('Please ask Family Frame to add an item to your shopping list.');
 const intent=envelope.request.intent;
 if(['AMAZON.StopIntent','AMAZON.CancelIntent'].includes(intent?.name))return say('Goodbye.');
 if(intent?.name==='AMAZON.HelpIntent'||intent?.name==='AMAZON.FallbackIntent')return say('Say add milk for Grocery Store, add two eggs to Costco, or add screws to Other. Add one item at a time.',false);
 if(intent?.name!=='AddItemIntent')return say('Say add followed by the item you need.',false);
 if(!configured())return say('Finish Family sync setup in the dashboard before adding groceries with Alexa.');
 try{
  const requestId=envelope.request.requestId;
  if(typeof requestId!=='string'||requestId.length>512)return json({error:'Invalid request ID'},400);
  const item=parseItem(intent.slots?.item?.value);
  await addItem(item,requestId);
  return say('Added '+(item.qty>1?item.qty+' ':'')+item.name+' to '+stores[item.store]+'.');
 }catch(error){return say(error instanceof ShoppingInputError?error.message:'I could not confirm the shopping update. Check your dashboard before trying again.',!(error instanceof ShoppingInputError));}
}};
