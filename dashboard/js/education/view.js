import { COURSE as C } from './course-data.js';
import { activeUnit,scheduledPosts,courseMetrics,gradeMetrics,assignmentDue,discussionDue,countdown,emptyState,validateState,dateInZone,addDate,zonedDate,calendarEvents,safeURL } from './model.js';
const App=window.App, key='frame-education-beyza-v1';
let state=emptyState(C), el=null, tab='overview', selectedUnit=null;
let month=dateInZone(new Date()).slice(0,7)+'-01', selectedDay=dateInZone(new Date());
try { const saved=localStorage.getItem(key);if(saved)state=validateState(JSON.parse(saved),C); }catch(_){ App.on('ready',()=>App.toast('Saved Education progress could not be read on this device.')); }
const esc=s=>App.esc(String(s??''));
const now=()=>new Date();
const done=id=>!!state.completions[id];
const check=(id,label)=>`<input type="checkbox" data-edu-check="${esc(id)}" aria-label="${esc(label)}" ${done(id)?'checked':''}>`;
const dateLabel=(date,options={})=>new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric',...options,timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
const instantLabel=date=>new Intl.DateTimeFormat('en-CA',{timeZone:state.settings.zone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(date);
const unitNow=()=>activeUnit(C,now()).unit;
const unit=()=>C.units.find(u=>u.id===(selectedUnit||unitNow()?.id|| (dateInZone(now())<C.start?1:5)));
const unitNav=()=>`<label class="edu-unit-select">Unit<select aria-label="Course unit" data-edu-unit>${C.units.map(u=>`<option value="${u.id}" ${u.id===unit().id?'selected':''}>Unit ${u.id} · ${dateLabel(u.start)}–${dateLabel(u.end)}</option>`).join('')}</select></label>`;
const button=(label,attrs='',cls='')=>`<button class="edu-btn ${cls}" ${attrs}>${label}</button>`;
function link(id,title,fallback='') {
  const url=safeURL(state.settings.links[id]||fallback);
  return url?`<a class="edu-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(title)} ↗</a>`:`<span class="edu-missing">${esc(title)} · link not set</span>`;
}
function persist(next=state) {
  const checked=validateState(next,C);
  localStorage.setItem(key,JSON.stringify(checked));state=checked;
}
function toggle(id) {
  const next=structuredClone(state);
  if(next.completions[id])delete next.completions[id];else next.completions[id]=new Date().toISOString();
  persist(next);render();
  const checkbox=Array.from(el.querySelectorAll('[data-edu-check]')).find(input=>input.dataset.eduCheck===id);
  checkbox?.focus({preventScroll:true});
}
function progress(count,total){return `<div class="edu-progress" aria-label="${count} of ${total} completed"><i style="width:${total?count/total*100:0}%"></i></div>`;}
function assignmentState(a) { return done('assignment:'+a.id)?'Submitted':assignmentDue(a)<now()?'Overdue':state.assignmentStatus[a.id]==='in-progress'?'In progress':'Upcoming'; }
function assignmentRow(a,compact=false) {
  const due=assignmentDue(a), status=assignmentState(a), urgent=!done('assignment:'+a.id)&&due-now()<7*864e5;
  return `<div class="edu-assignment ${urgent?'is-urgent':''}"><label class="edu-check-label">${check('assignment:'+a.id,'Mark '+a.title+' submitted')}<span><b>${esc(a.title)}</b><small>${esc(instantLabel(due))} · ${a.weight}%</small></span></label><span class="edu-countdown">${done('assignment:'+a.id)?'Submitted':esc(countdown(due,now()))}</span>${compact?'':`<span class="edu-status">${status}</span>`}</div>`;
}
function readingStats(u) {
  const required=u.readings.filter(r=>!r.optional);return {required,completed:required.filter(r=>done('reading:'+r.id)).length,chapters:required.filter(r=>r.type==='chapter').length,articles:required.filter(r=>r.type==='article').length,resources:required.filter(r=>!['chapter','article'].includes(r.type)).length};
}
function weekPosts(u){return scheduledPosts(C).filter(p=>p.unit===u.id);}
function weekProgress(u) {
  const posts=weekPosts(u);
  return `<div class="edu-weekdays">${['M','T','W','T','F'].map((name,i)=>{const date=addDate(u.start,i),daily=posts.filter(p=>p.date===date);return `<span class="${date===dateInZone(now())?'is-today':''}" title="${date}">${name}<b>${daily.filter(p=>done(p.id)).length}/${daily.length}</b></span>`;}).join('')}</div>`;
}
function monthly(compact=false) {
  const first=compact?dateInZone(now()).slice(0,7)+'-01':month;
  const d=new Date(first+'T12:00:00Z'), offset=(d.getUTCDay()+6)%7, start=addDate(first,-offset);
  const events=calendarEvents(C,state), today=dateInZone(now());
  return `<div class="edu-month ${compact?'is-mini':''}"><div class="edu-month-head">${compact?'':button('‹','data-edu-month="-1" aria-label="Previous month"')}<b>${dateLabel(first,{month:'long',year:'numeric'}).replace(/\s+1,?/, '')}</b>${compact?button('Open','data-edu-tab="calendar"'):button('›','data-edu-month="1" aria-label="Next month"')}</div><div class="edu-month-grid">${['M','T','W','T','F','S','S'].map(n=>`<span class="edu-dow">${n}</span>`).join('')}${Array.from({length:42},(_,i)=>{const day=addDate(start,i),items=events.filter(e=>e.date===day),kinds=[...new Set(items.map(e=>e.kind))];return `<button data-edu-day="${day}" class="edu-day ${day.slice(0,7)!==first.slice(0,7)?'is-outside':''} ${day===today?'is-today':''} ${!compact&&day===selectedDay?'is-selected':''}" aria-label="${day}${items.length?', '+items.map(e=>e.title).join(', '):''}"><span>${+day.slice(-2)}</span><i>${kinds.map(k=>`<em class="dot-${k}"></em>`).join('')}</i></button>`;}).join('')}</div></div>`;
}
function upcomingMilestones() {
  const today=dateInZone(now());
  const pending=C.milestones.filter(m=>!done('milestone:'+m.id)).sort((a,b)=>(a.date||a.window?.[1]||C.end).localeCompare(b.date||b.window?.[1]||C.end));
  const upcoming=pending.filter(m=>(m.date||m.window?.[1]||C.end)>=today);
  return upcoming.length?upcoming:pending;
}
function milestoneRow(m) {
  let date=m.date?dateLabel(m.date):m.id==='seminar-meeting'&&state.settings.meetingDate?dateLabel(state.settings.meetingDate)+(state.settings.meetingTime?' · '+state.settings.meetingTime:''):m.window?dateLabel(m.window[0])+'–'+dateLabel(m.window[1]):'Date not set';
  return `<label class="edu-milestone ${done('milestone:'+m.id)?'is-done':''}">${check('milestone:'+m.id,m.title)}<span>${esc(m.title)}<small>${esc(date)}${m.id==='seminar-meeting'&&!state.settings.meetingDate?' · meeting not scheduled':''}</small></span></label>`;
}
function overview() {
  const active=activeUnit(C,now()), u=active.unit, stats=courseMetrics(C,state), next=C.assignments.filter(a=>!done('assignment:'+a.id)).slice(0,3), today=dateInZone(now());
  const posts=u?weekPosts(u).filter(p=>p.date===today):[], readings=u?readingStats(u):null;
  const weekItems=u?[...weekPosts(u).map(p=>p.id),...C.assignments.filter(a=>a.dueDate>=u.start&&a.dueDate<=u.end).map(a=>'assignment:'+a.id)]:[];
  const finished=weekItems.filter(done).length;
  return `<div class="edu-summary"><div><span class="edu-eyebrow">BEYZA’S STUDY SPACE · ${C.code}</span><b>${C.title}</b><span>${active.phase==='completed'?'Course completed':active.phase==='upcoming'?'Course starts '+dateLabel(C.start):`Unit ${u.id} of ${C.units.length} · ${dateLabel(u.start)}–${dateLabel(u.end)}`}</span></div><div class="edu-summary-next"><strong>${stats.daysLeft}<small>days left</small></strong>${next[0]?`<span>Next assignment · ${esc(countdown(assignmentDue(next[0]),now()))}</span>`:'<span>All assignments submitted</span>'}</div></div><div class="edu-overview"><div class="edu-overview-left"><section class="edu-card edu-deadlines"><div class="edu-card-head"><h2>Upcoming assignments</h2>${button('View all','data-edu-tab="assignments"')}</div>${next.length?next.map(a=>assignmentRow(a,true)).join(''):'<p class="edu-muted">All assignments submitted.</p>'}</section><section class="edu-card edu-discussions-summary"><div class="edu-card-head"><h2>Today’s discussion posts</h2>${button('View all','data-edu-tab="discussions"')}</div>${posts.length?posts.map(p=>`<label class="edu-today-post">${check(p.id,p.question+' scheduled post for '+p.date)}<span><b>${esc(p.question)}</b> ${esc(p.title)}</span></label>`).join(''):`<p class="edu-muted">${!u?active.phase==='completed'?'Course ended. Past posts remain available.':'The course has not started.':'No posts scheduled today. Review unfinished posts in Discussions.'}</p>`}${u?weekProgress(u):''}</section><section class="edu-card edu-readings-summary"><div class="edu-card-head"><h2>Weekly readings</h2>${button('Open readings','data-edu-tab="readings"')}</div>${readings?`<div class="edu-reading-counts"><span><b>${readings.chapters}</b> chapters</span><span><b>${readings.articles}</b> articles</span><span><b>${readings.resources}</b> videos / resources</span></div>${progress(readings.completed,readings.required.length)}<small>${readings.completed}/${readings.required.length} required complete</small>`:'<p class="edu-muted">Select a unit in Readings to review its reading list.</p>'}</section></div><div class="edu-overview-right"><section class="edu-card edu-mini-calendar">${monthly(true)}</section><section class="edu-card edu-course-progress"><div class="edu-card-head"><h2>Course progress</h2><span>${Math.round(stats.completionPercent)}% complete</span></div>${progress(stats.completed,stats.total)}<div class="edu-progress-metrics"><span>${stats.assignments}/${C.assignments.length} assignments</span><span>${stats.posts}/${scheduledPosts(C).length} posts</span></div><div class="edu-weekly-progress">Weekly work ${finished}/${weekItems.length}${progress(finished,weekItems.length)}</div></section><section class="edu-card edu-milestones"><div class="edu-card-head"><h2>Important reminders</h2>${button('View all','data-edu-tab="assignments"')}</div>${upcomingMilestones().slice(0,3).map(milestoneRow).join('')||'<p class="edu-muted">All milestones complete.</p>'}</section></div></div>`;
}
function assignments() {
  const open=C.assignments.filter(a=>!done('assignment:'+a.id)), submitted=C.assignments.filter(a=>done('assignment:'+a.id));
  const card=a=>`<article class="edu-card edu-assignment-card">${assignmentRow(a)}<div class="edu-assignment-tools"><span>Official due: ${dateLabel(a.dueDate)} · 11:55 PM Atlantic</span></div><details><summary>Requirements & submission</summary><ul>${a.requirements.map(r=>`<li>${esc(r)}</li>`).join('')}</ul><p><b>Format:</b> ${esc(a.format)}</p><p><b>References:</b> ${esc(a.references)}</p><div class="edu-links">${link(a.id+'-submission','Submission')}${link(a.id+'-rubric','Rubric')}</div></details>${a.milestones.length?`<div class="edu-assignment-milestones">${a.milestones.map(id=>milestoneRow(C.milestones.find(m=>m.id===id))).join('')}</div>`:''}</article>`;
  return `<div class="edu-detail-heading"><h2>Assignments</h2><span>Deadlines shown in ${esc(state.settings.zone)}</span></div>${open.map(card).join('')}${submitted.length?'<h3>Submitted</h3>'+submitted.map(card).join(''):''}<section class="edu-card"><h3>End-of-course reminders</h3>${C.milestones.filter(m=>['survey','save-work'].includes(m.id)).map(milestoneRow).join('')}</section>`;
}
function discussions() {
  const u=unit(), posts=weekPosts(u), count=posts.filter(p=>done(p.id)).length, expired=now()>discussionDue(u,state.settings);
  return `<div class="edu-detail-heading"><div><h2>Discussions</h2><p>${count}/${posts.length} posts complete · ${Math.round(count/posts.length*100)}%</p></div>${unitNav()}</div><p class="edu-note">Sunday deadline: ${dateLabel(u.end)}${state.settings.discussionTime?' · '+esc(instantLabel(discussionDue(u,state.settings))):' · submission time not supplied'}. Personal target: five posts per question on separate weekdays.</p>${u.discussions.map(q=>{const list=posts.filter(p=>p.question===q.id),n=list.filter(p=>done(p.id)).length;return `<article class="edu-card"><div class="edu-card-head"><h2>${q.id} ${esc(q.title)}</h2><span>${n}/5 ${expired&&n<5?'· Overdue':''}</span></div><div class="edu-post-grid">${list.map(p=>`<label class="${p.date===dateInZone(now())?'is-today':''}"><b>${new Intl.DateTimeFormat('en',{weekday:'short',timeZone:'UTC'}).format(new Date(p.date+'T12:00:00Z'))}</b><span>${dateLabel(p.date)}</span>${check(p.id,q.title+' · '+p.date)}<small>${done(p.id)?'Complete':'Not complete'}</small></label>`).join('')}</div></article>`;}).join('')}`;
}
function readings() {
  const u=unit(), stats=readingStats(u);
  const groups=[['chapter','Textbook chapters'],['article','Required journal articles'],['resource','Required videos & resources'],['optional','Optional resources']];
  return `<div class="edu-detail-heading"><div><h2>Readings</h2><p>${stats.completed}/${stats.required.length} required complete</p></div>${unitNav()}</div>${progress(stats.completed,stats.required.length)}<p class="edu-note">Titles from the course brief. Full citations and resource links were not included.</p>${groups.map(([type,title])=>{const list=u.readings.filter(r=>type==='optional'?r.optional:!r.optional&&(type==='resource'?!['chapter','article'].includes(r.type):r.type===type));if(!list.length)return '';return `<section class="edu-card"><h3>${title}</h3>${list.map(r=>`<div class="edu-reading-row"><label class="edu-check-label">${check('reading:'+r.id,r.title)}<span><b>${esc(r.title)}</b><small>${esc(r.author||r.type)}${r.optional?' · Optional — excluded from progress':''}</small></span></label>${r.type==='chapter'?'':link(r.id,'Resource',r.url)}</div>`).join('')}</section>`;}).join('')}`;
}
function calendar() {
  const items=calendarEvents(C,state).filter(e=>e.date===selectedDay);
  return `<div class="edu-detail-heading"><h2>Academic calendar</h2><span>Monday–Sunday</span></div><div class="edu-calendar-layout"><section class="edu-card">${monthly()}</section><section class="edu-card"><h3>${dateLabel(selectedDay,{year:'numeric'})}</h3>${items.length?items.map(e=>`<div class="edu-calendar-event"><i class="dot-${e.kind}"></i><span>${esc(e.title)}${e.assignment?'<small>'+esc(instantLabel(assignmentDue(C.assignments.find(a=>a.id===e.assignment))))+'</small>':''}</span></div>`).join(''):'<p class="edu-muted">No academic events on this date.</p>'}<p class="edu-note">Discussion and sign-up dates have no supplied cutoff time. Seminar time appears only when configured.</p></section></div>`;
}
function render() {
  if(!el)return;
  const active=activeUnit(C,now());
  el.innerHTML=`<div class="education ${state.settings.dark?'edu-dark':''}"><header class="edu-header"><button class="edu-logo" data-edu-tab="overview" aria-label="Education Overview"><img src="/assets/yorkville-university.png" alt="Yorkville University"></button><div class="edu-heading"><h1>MACP Academic Dashboard <span>Beyza</span></h1><p>${C.program}</p></div><div class="edu-header-right"><span>${new Intl.DateTimeFormat('en-CA',{timeZone:state.settings.zone,weekday:'short',month:'short',day:'numeric'}).format(now())}</span><small>${active.phase==='active'?'Unit '+active.unit.id+' of '+C.units.length:active.phase==='completed'?'Course completed':'Course upcoming'}</small></div><span class="edu-profile"><img src="/assets/beyza-profile.jpg" alt="Beyza’s profile picture"></span></header><nav class="edu-nav" aria-label="Academic sections">${['overview','assignments','discussions','readings','calendar'].map(t=>`<button data-edu-tab="${t}" aria-current="${tab===t?'page':'false'}" class="${tab===t?'is-active':''}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</nav><main class="edu-content ${tab==='overview'?'edu-content-overview':''}">${({overview,assignments,discussions,readings,calendar})[tab]()}</main><footer class="edu-footer"><span>${C.instructor} · <a href="mailto:${C.email}">${C.email}</a></span><span>${C.links.filter(l=>safeURL(state.settings.links[l.id]||l.url)).slice(0,3).map(l=>link(l.id,l.title,l.url)).join(' · ')}</span></footer></div>`;
}
function click(event) {
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.eduTab){tab=button.dataset.eduTab;render();return;}
  if(button.dataset.eduDay){selectedDay=button.dataset.eduDay;month=selectedDay.slice(0,7)+'-01';tab='calendar';render();return;}
  if(button.dataset.eduMonth){const date=new Date(month+'T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+ +button.dataset.eduMonth);month=date.toISOString().slice(0,10);render();}
}
function change(event) {
  const input=event.target;
  try {
    if(input.dataset.eduCheck){toggle(input.dataset.eduCheck);return;}
    if(input.hasAttribute('data-edu-unit')){selectedUnit=+input.value;render();}
  }catch(error){App.toast('Could not save Education progress on this device.');if(input.type==='checkbox')input.checked=done(input.dataset.eduCheck);}
}
App.register('education',{minutely:true,show(element){if(!el){el=element;el.addEventListener('click',click);el.addEventListener('change',change);}render();},resume:render});
App.on('minute',()=>{if(App.current==='education'&&!el.contains(document.activeElement?.closest('input,select,textarea')))render();});
window.addEventListener('storage',event=>{if(event.key===key||event.key===null){try{state=event.newValue?validateState(JSON.parse(event.newValue),C):emptyState(C);render();}catch(_){App.toast('Education data from another tab could not be read.');}}});
