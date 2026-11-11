import weatherHandler from '../server/weather-handler.js';
import prayersHandler from '../server/prayers-handler.js';

export default function handler(req,res){
 const resource=req.query?.resource||'weather';
 if(resource==='prayers')return prayersHandler(req,res);
 if(resource==='weather')return weatherHandler(req,res);
 return res.status(400).json({error:'Unknown forecast resource'});
}
