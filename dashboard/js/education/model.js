export function dateInZone(date, zone='America/Toronto') {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(p=>[p.type,p.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function addDate(date, days) { const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10); }
export function zonedDate(date,time,zone) {
  const [y,m,d]=date.split('-').map(Number),[h,n]=time.split(':').map(Number), target=Date.UTC(y,m-1,d,h,n);
  let instant=target;
  for(let i=0;i<4;i++) {
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
    const actual=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute), delta=target-actual;
    instant+=delta; if(!delta) return new Date(instant);
  }
  throw new Error('This local time does not exist. Choose another time.');
}
export function activeUnit(course, now=new Date()) {
  const day=dateInZone(now);
  if(day<course.start)return {phase:'upcoming',unit:course.units[0]};
  if(day>course.end)return {phase:'completed',unit:null};
  return {phase:'active',unit:course.units.find(u=>u.start<=day&&u.end>=day)};
}
export function scheduledPosts(course) {
  return course.units.flatMap(unit=>unit.discussions.flatMap(question=>Array.from({length:5},(_,i)=>({id:`post:${question.id}:${addDate(unit.start,i)}`,date:addDate(unit.start,i),unit:unit.id,question:question.id,title:question.title}))));
}
export function allCompletionIds(course) {
  return new Set([...course.assignments.map(a=>'assignment:'+a.id),...scheduledPosts(course).map(p=>p.id),...course.units.flatMap(u=>u.readings.map(r=>'reading:'+r.id)),...course.milestones.map(m=>'milestone:'+m.id)]);
}
export function courseMetrics(course,state,now=new Date()) {
  const start=+zonedDate(course.start,'00:00','America/Toronto'), end=+zonedDate(addDate(course.end,1),'00:00','America/Toronto');
  const posts=scheduledPosts(course),required=course.units.flatMap(u=>u.readings.filter(r=>!r.optional));
  const completionIds=[...course.assignments.map(a=>'assignment:'+a.id),...posts.map(p=>p.id)];
  const completed=completionIds.filter(id=>state.completions[id]).length;
  return {completed,total:completionIds.length,completionPercent:completionIds.length?completed/completionIds.length*100:0,elapsed:Math.max(0,Math.min(100,(+now-start)/(end-start)*100)),daysLeft:Math.max(0,Math.ceil((end-now)/864e5)),assignments:course.assignments.filter(a=>state.completions['assignment:'+a.id]).length,posts:posts.filter(p=>state.completions[p.id]).length,readings:required.filter(r=>state.completions['reading:'+r.id]).length,required:required.length};
}
export function gradeMetrics(course,grades) {
  let weight=0,points=0;
  course.grading.forEach(g=>{ const grade=grades[g.id];if(typeof grade==='number'&&Number.isFinite(grade)&&grade>=0&&grade<=100){weight+=g.weight;points+=grade*g.weight/100;} });
  return {weight,points,average:weight?points/weight*100:null};
}
export function assignmentDue(assignment) { return zonedDate(assignment.dueDate,assignment.dueTime,assignment.zone); }
export function discussionDue(unit,settings) { return zonedDate(settings.discussionTime?unit.end:addDate(unit.end,1),settings.discussionTime||'00:00',settings.discussionZone||'America/Halifax'); }
export function countdown(due,now=new Date()) {
  const diff=+due-+now;
  if(diff<=0)return 'Overdue';
  const hours=Math.ceil(diff/36e5);return `${Math.floor(hours/24)}d ${hours%24}h remaining`;
}
export function emptyState(course) { return {version:1,courseId:course.id,completions:{},assignmentStatus:{},grades:{},settings:{dark:false,zone:'America/Toronto',discussionTime:'',discussionZone:'America/Halifax',links:{},meetingDate:'',meetingTime:'',meetingUrl:''}}; }
export function safeURL(value) { try {const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';} }
export function validateState(input,course) {
  if(!input||input.version!==1||input.courseId!==course.id)throw new Error('This backup is not for this course or version.');
  const output=emptyState(course),ids=allCompletionIds(course);
  if(!input.completions||typeof input.completions!=='object'||Array.isArray(input.completions))throw new Error('Invalid completion records.');
  for(const [id,value]of Object.entries(input.completions)) {
    if(!ids.has(id)||typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw new Error('Invalid completion record.');
    output.completions[id]=value;
  }
  for(const a of course.assignments)if(['upcoming','in-progress'].includes(input.assignmentStatus?.[a.id]))output.assignmentStatus[a.id]=input.assignmentStatus[a.id];
  for(const g of course.grading)if(input.grades?.[g.id]!=null) {
    const n=input.grades[g.id];if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>100)throw new Error('Grades must be between 0 and 100.');output.grades[g.id]=n;
  }
  const s=input.settings||{};
  output.settings.dark=s.dark===true;
  for(const key of ['zone','discussionZone'])if(s[key]){try{new Intl.DateTimeFormat('en',{timeZone:s[key]});output.settings[key]=s[key];}catch{throw new Error('Invalid time zone.');}}
  for(const key of ['discussionTime','meetingTime'])if(s[key]){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(s[key]))throw new Error('Invalid time.');output.settings[key]=s[key];}
  if(s.meetingDate){if(!/^\d{4}-\d{2}-\d{2}$/.test(s.meetingDate)||addDate(s.meetingDate,0)!==s.meetingDate)throw new Error('Invalid meeting date.');output.settings.meetingDate=s.meetingDate;}
  if(s.meetingUrl){if(!safeURL(s.meetingUrl))throw new Error('Use an http or https meeting link.');output.settings.meetingUrl=safeURL(s.meetingUrl);}
  const linkIds=[...course.links.map(l=>l.id),...course.assignments.flatMap(a=>[a.id+'-submission',a.id+'-rubric']),...course.units.flatMap(u=>u.readings.map(r=>r.id))];
  for(const id of linkIds)if(s.links?.[id]){if(!safeURL(s.links[id]))throw new Error('Resource links must use http or https.');output.settings.links[id]=safeURL(s.links[id]);}
  return output;
}
export function calendarEvents(course,state) {
  const events=[];
  course.units.forEach(u=>{events.push({date:u.start,title:`Unit ${u.id} starts`,kind:'unit'},{date:u.end,title:`Unit ${u.id} discussions due`,kind:'discussion'},{date:u.end,title:`Unit ${u.id} ends`,kind:'unit'});});
  course.assignments.forEach(a=>events.push({date:a.dueDate,title:a.title+' due',kind:'assignment',assignment:a.id}));
  course.milestones.filter(m=>m.date).forEach(m=>events.push({date:m.date,title:m.title,kind:'milestone'}));
  if(state.settings.meetingDate)events.push({date:state.settings.meetingDate,title:'Group seminar meeting'+(state.settings.meetingTime?' · '+state.settings.meetingTime:''),kind:'meeting'});
  else { const seminar=course.milestones.find(m=>m.id==='seminar-meeting'); if(seminar?.window) events.push({date:seminar.window[0],title:'Seminar meeting period begins (date not set)',kind:'meeting'}); }
  events.push({date:course.end,title:'Course completion',kind:'unit'});
  return events;
}
