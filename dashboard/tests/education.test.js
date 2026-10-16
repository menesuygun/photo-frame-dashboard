import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSE as C } from '../js/education/course-data.js';
import { activeUnit,scheduledPosts,courseMetrics,gradeMetrics,assignmentDue,discussionDue,emptyState,validateState,calendarEvents,zonedDate,addDate } from '../js/education/model.js';
test('course has exactly seven questions and 35 distinct weekday posts anchored to real dates',()=>{
 const posts=scheduledPosts(C);assert.equal(posts.length,35);assert.equal(new Set(posts.map(p=>p.id)).size,35);assert.equal(C.units.flatMap(u=>u.discussions).length,7);
 for(const u of C.units){const list=posts.filter(p=>p.unit===u.id);assert.equal(list.length,u.discussions.length*5);for(const q of u.discussions)assert.deepEqual(list.filter(p=>p.question===q.id).map(p=>p.date),Array.from({length:5},(_,i)=>addDate(u.start,i)));}
 assert.ok(posts.every(p=>![0,6].includes(new Date(p.date+'T12:00:00Z').getUTCDay())));
});
test('Atlantic deadlines change UTC offset across DST while remaining 10:55 PM Ontario local',()=>{
 assert.equal(assignmentDue(C.assignments[0]).toISOString(),'2026-10-26T02:55:00.000Z');
 assert.equal(assignmentDue(C.assignments[1]).toISOString(),'2026-11-09T03:55:00.000Z');
 assert.equal(assignmentDue(C.assignments[2]).toISOString(),'2026-11-16T03:55:00.000Z');
 for(const a of C.assignments)assert.equal(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(assignmentDue(a)),'22:55');
});
test('active unit changes Monday, respects Ontario midnight, and ends rather than staying Unit 5',()=>{
 assert.equal(activeUnit(C,new Date('2026-10-12T03:59:59Z')).phase,'upcoming');
 assert.equal(activeUnit(C,new Date('2026-10-19T03:59:59Z')).unit.id,1);
 assert.equal(activeUnit(C,new Date('2026-10-19T04:00:00Z')).unit.id,2);
 assert.equal(activeUnit(C,new Date('2026-11-16T04:59:59Z')).unit.id,5);
 assert.equal(activeUnit(C,new Date('2026-11-16T05:00:00Z')).phase,'completed');
});
test('optional reading does not count; elapsed time and completed work remain independent',()=>{
 const state=emptyState(C),optional=C.units[1].readings.find(r=>r.optional);
 state.completions['reading:'+optional.id]=new Date().toISOString();
 const metrics=courseMetrics(C,state,new Date('2026-11-03T12:00:00Z'));
 assert.ok(metrics.elapsed>50);assert.equal(metrics.readings,0);assert.equal(metrics.posts,0);assert.equal(metrics.required,36);
});
test('grade average excludes ungraded work, permits zero, and weights graded components',()=>{
 assert.equal(gradeMetrics(C,{}).average,null);
 assert.deepEqual(gradeMetrics(C,{genogram:80}),{weight:30,points:24,average:80});
 const m=gradeMetrics(C,{genogram:80,'case-study':90});assert.equal(m.weight,65);assert.equal(m.points,55.5);assert.ok(Math.abs(m.average-85.384615)<0.001);
 assert.equal(gradeMetrics(C,{discussions:0}).weight,25);
});
test('backup validates stable records, preserves history and rejects unsafe imports',()=>{
 const state=emptyState(C),post=scheduledPosts(C)[0];state.completions[post.id]='2026-10-20T12:00:00Z';state.grades.genogram=85;
 assert.equal(validateState(JSON.parse(JSON.stringify(state)),C).completions[post.id],'2026-10-20T12:00:00Z');
 assert.throws(()=>validateState({...state,courseId:'other'},C));
 assert.throws(()=>validateState({...state,grades:{genogram:101}},C));
 assert.throws(()=>validateState({...state,settings:{links:{brightspace:'javascript:alert(1)'}}},C));
 assert.throws(()=>validateState({...state,completions:{fictional:'2026-10-12T00:00:00Z'}},C));
 assert.equal(validateState({...state,completions:{}},C).grades.genogram,85);
});
test('calendar uses actual assignment dates and group deadlines without inventing a seminar appointment',()=>{
 const state=emptyState(C),events=calendarEvents(C,state);
 assert.equal(events.filter(e=>e.date==='2026-10-18'&&e.kind==='milestone').length,2);
 assert.equal(events.filter(e=>e.kind==='assignment').length,3);
 assert.ok(events.find(e=>e.title==='Course completion'&&e.date==='2026-11-15'));
 assert.ok(events.find(e=>e.kind==='meeting').title.includes('not set'));
 state.settings.meetingDate='2026-11-11';state.settings.meetingTime='18:30';assert.ok(calendarEvents(C,state).some(e=>e.date==='2026-11-11'&&e.title.includes('18:30')));
});
test('discussion cutoff remains configurable and handles DST; impossible local times are rejected',()=>{
 const state=emptyState(C);
 assert.equal(state.settings.discussionTime,'');
 assert.equal(discussionDue(C.units[2],{discussionZone:'America/Halifax',discussionTime:'23:55'}).toISOString(),'2026-11-02T03:55:00.000Z');
 assert.equal(discussionDue(C.units[0],state.settings).toISOString(),'2026-10-19T03:00:00.000Z');
 assert.throws(()=>zonedDate('2026-03-08','02:30','America/Toronto'));
});
