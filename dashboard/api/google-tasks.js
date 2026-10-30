import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {authorized,configured} from '../server/household.js';
import {origin,redirect,oauthReady,connection,lease,release,setCredentials,tokenRequest,seal,unseal,synchronize} from '../server/google-tasks.js';
export const maxDuration=60;
const cookieName='frame_google_tasks_oauth';
function cookie(value,maxAge=600){return cookieName+'='+value+'; Path=/api/google-tasks; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge;}
const hash=value=>createHash('sha256').update(String(value)).digest();
function page(res,title,text){res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));return res.status(200).send('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><body style="margin:0;padding:40px 24px;background:#f2efe6;color:#111;font:18px system-ui;max-width:640px"><h1>'+esc(title)+'</h1><p>'+esc(text)+'</p><a href="'+origin+'/#home" style="color:inherit">Return to your dashboard</a></body></html>');}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Authorization');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
 const action=String(req.query?.action||'status');
 if(action==='callback'){
  if(req.method!=='GET')return res.status(405).end();
  const encrypted=String(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith(cookieName+'='))?.slice(cookieName.length+1);res.setHeader('Set-Cookie',cookie('',0));
  try{
   if(!oauthReady()||!configured()||!encrypted)throw Error('The connection request expired. Open Google Tasks settings and try again.');
   const state=unseal(encrypted);
   if(state.expires<Date.now()||state.household!==process.env.HOUSEHOLD_ID||!timingSafeEqual(hash(state.nonce),hash(req.query.state)))throw Error('The connection request expired. Open Google Tasks settings and try again.');
   if(req.query.error)throw Error('Google Tasks access was not granted. Your dashboard data is unchanged.');
   if(typeof req.query.code!=='string')throw Error('Google did not return an authorization code.');
   const tokens=await tokenRequest({grant_type:'authorization_code',code:req.query.code,redirect_uri:redirect,code_verifier:state.verifier});
   if(!tokens.refresh_token||!String(tokens.scope||'').split(' ').includes('https://www.googleapis.com/auth/tasks'))throw Error('Allow Google Tasks access and try connecting again.');
   const lock=await lease();try{await setCredentials(lock.token,{...tokens,expires_at:Date.now()+tokens.expires_in*1000});}finally{await release(lock.token);}
   return page(res,'Google Tasks connected','Return to the dashboard and open Family sync → Google Tasks to start syncing Chores, Reminders, and Shopping.');
  }catch(error){return page(res,'Google Tasks was not connected',error.message==='Shared storage unavailable'?'Finish the private Google Tasks database setup, then try again.':error.message);}
 }
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 if(!authorized(req))return res.status(401).json({error:'Connect this device with your frame access code first.'});
 if(!configured())return res.status(503).json({error:'Connect Family sync first.',setup:true});
 // Prevent a foreign web origin from using the connection's state-changing routes.
 if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==origin)return res.status(403).json({error:'Open the permanent dashboard link to connect Google Tasks.'});
 try{
  if(req.method==='GET'&&action==='status'){
   let row;try{row=await connection();}catch{return res.status(200).json({configured:oauthReady(),setup:true,connected:false,error:'Run the Google Tasks database setup before connecting.'});}
   return res.status(200).json({configured:oauthReady(),connected:!!row?.credentials,lastSync:row?.last_sync||null,conflicts:Object.values(row?.state?.conflicts||{})});
  }
  if(req.method!=='POST')return res.status(405).json({error:'Use POST for this action.'});
  if(!oauthReady())return res.status(503).json({setup:true,error:'Save GOOGLE_TASKS_CLIENT_ID and GOOGLE_TASKS_CLIENT_SECRET in Vercel Production, then redeploy.'});
  if(action==='authorize'){
   // Check private persistence before asking Google for access.
   await connection();
   const nonce=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url'),state={nonce,verifier,household:process.env.HOUSEHOLD_ID,expires:Date.now()+600000};
   res.setHeader('Set-Cookie',cookie(seal(state)));
   const params=new URLSearchParams({client_id:process.env.GOOGLE_TASKS_CLIENT_ID,redirect_uri:redirect,response_type:'code',scope:'https://www.googleapis.com/auth/tasks',access_type:'offline',prompt:'consent',state:nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
   return res.status(200).json({url:'https://accounts.google.com/o/oauth2/v2/auth?'+params});
  }
  if(action==='disconnect'){const lock=await lease();try{await setCredentials(lock.token,null);}finally{await release(lock.token);}return res.status(200).json({connected:false});}
  if(action==='sync'){
   const body=req.body||{},r=body.resolution;
   if(r&&(!r.key||typeof r.key!=='string'||r.key.length>180||!['google','dashboard'].includes(r.choice)))return res.status(400).json({error:'Invalid conflict choice.'});
   return res.status(200).json(await synchronize({force:body.force===true||!!r,resolution:r}));
  }
  return res.status(400).json({error:'Unknown action.'});
 }catch(error){const known=/Google|google|Sync|sync|chore|Chore|Shopping|shopping|Household|household|Connect|connect|Shorten|Shorten|task|Task|item|Item|Quantity|Select|Review|Rename|duplicate|Duplicate|positive|Dashboard|dashboard/.test(error.message);return res.status(502).json({error:known?error.message:'Google Tasks sync paused. Your local data is safe. Try again shortly.'});}
}
