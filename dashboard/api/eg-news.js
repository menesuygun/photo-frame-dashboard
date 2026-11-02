import {townNews,source} from '../server/eg-news.js';
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 try{const result=await townNews();res.setHeader('Cache-Control',result.stale?'public, s-maxage=60':'public, s-maxage=900, stale-while-revalidate=3600');return res.status(200).json({...result,source});}
 catch{res.setHeader('Cache-Control','public, s-maxage=60');return res.status(503).json({error:'Town news temporarily unavailable',source});}
}
