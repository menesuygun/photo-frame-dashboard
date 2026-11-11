import calendarHandler from '../server/calendar-handler.js';
import travelHandler from '../server/travel-handler.js';
export {getCalendarPayload} from '../server/calendar-handler.js';

export default function handler(req,res){
 const action=req.query?.action||'calendar';
 if(action==='travel')return travelHandler(req,res);
 if(action==='calendar')return calendarHandler(req,res);
 return res.status(400).json({error:'Unknown calendar action'});
}
