import {authorized,configured,validateDocument,supabase,categories} from '../server/household.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Authorization');
 if(!['GET','POST','PUT'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 if(!authorized(req))return res.status(401).json({error:'Connect this device with your frame access code.'});
 if(!configured())return res.status(503).json({error:'Shared storage setup is not finished.',setup:true});
 const household=process.env.HOUSEHOLD_ID;
 try{
  if(req.method==='GET'){
   const filter='/rest/v1/household_documents?household=eq.'+encodeURIComponent(household);
   if(req.query?.versions){
    let versions;try{versions=JSON.parse(req.query.versions);}catch{return res.status(400).json({error:'Invalid revisions'});}
    if(!versions||Array.isArray(versions)||Object.entries(versions).some(([k,v])=>!categories.includes(k)||!Number.isSafeInteger(v)||v<1))return res.status(400).json({error:'Invalid revisions'});
    const summary=await supabase(filter+'&select=category,revision');
    const changed=summary.filter(d=>versions[d.category]!==d.revision);
    const documents=changed.length?await supabase(filter+'&category=in.('+changed.map(d=>d.category).join(',')+')&select=category,value,revision,updated_at'):[];
    return res.status(200).json({initialized:summary.length>0,documents});
   }
   const documents=await supabase(filter+'&select=category,value,revision,updated_at');
   return res.status(200).json({initialized:documents.length>0,documents});
  }
  const body=req.body;
  if(!body||typeof body!=='object'||Array.isArray(body))return res.status(400).json({error:'Invalid request'});
  if(req.method==='POST'){
   const documents=body.documents;
   if(!documents||Array.isArray(documents)||!Object.keys(documents).length||Object.keys(documents).some(k=>!validateDocument(k,documents[k])))return res.status(400).json({error:'Invalid household import'});
   const created=await supabase('/rest/v1/rpc/initialize_household',{method:'POST',body:{p_household:household,p_documents:documents}});
   return res.status(created?201:409).json(created?{imported:true}:{error:'This household already has shared data. Nothing was overwritten.'});
  }
  if(!validateDocument(body.category,body.value)||!Number.isSafeInteger(body.revision)||body.revision<0)return res.status(400).json({error:'Invalid update'});
  const rows=await supabase('/rest/v1/rpc/save_household_document',{method:'POST',body:{p_household:household,p_category:body.category,p_value:body.value,p_expected:body.revision}});
  return rows.length?res.status(200).json({document:rows[0]}):res.status(409).json({error:'Another device updated this data. Refresh before saving.'});
 }catch{return res.status(502).json({error:'Shared storage could not be reached. Local data is unchanged.'});}
}
