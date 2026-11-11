import householdHandler from '../server/household-handler.js';
import photosHandler from '../server/household-photos-handler.js';

export default function handler(req,res){
 const action=req.query?.action||'household';
 if(action==='photos')return photosHandler(req,res);
 if(action==='household')return householdHandler(req,res);
 res.setHeader('Cache-Control','private, no-store');
 return res.status(400).json({error:'Unknown household action'});
}
