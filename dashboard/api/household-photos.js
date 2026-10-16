import {createClient} from '@supabase/supabase-js';
import {authorized,configured,supabase} from '../server/household.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Authorization');
 if(!authorized(req))return res.status(401).json({error:'Connect this device first.'});
 if(!configured())return res.status(503).json({error:'Shared storage setup is not finished.'});
 const household=process.env.HOUSEHOLD_ID;
 const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const bucket=client.storage.from('household-photos');
 try{
  if(req.method==='POST'){
   const id=req.body?.id;if(typeof id!=='string'||!/^[-a-f0-9]{36}$/i.test(id))return res.status(400).json({error:'Invalid photo ID'});
   const path=household+'/'+id+'.jpg';const {data,error}=await bucket.createSignedUploadUrl(path,{upsert:true});if(error)throw error;
   return res.status(200).json({path,url:data.signedUrl});
  }
  if(req.method==='GET'){
   const rows=await supabase('/rest/v1/household_documents?household=eq.'+encodeURIComponent(household)+'&category=eq.photos&select=value');
   const photos=rows[0]?.value||[];if(!photos.length)return res.status(200).json({photos:[]});
   const paths=photos.map(p=>household+'/'+p.id+'.jpg');const {data,error}=await bucket.createSignedUrls(paths,3600);if(error)throw error;
   return res.status(200).json({photos:photos.map((p,i)=>({...p,url:data[i].signedUrl}))});
  }
  return res.status(405).json({error:'Method not allowed'});
 }catch{return res.status(502).json({error:'Photo storage is unavailable. Your device photos are unchanged.'});}
}
