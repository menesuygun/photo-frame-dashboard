// Course facts transcribed from the user's supplied course brief. Add future courses here.
const unitStarts = ['2026-10-12','2026-10-19','2026-10-26','2026-11-02','2026-11-09'];
const unitEnds = ['2026-10-18','2026-10-25','2026-11-01','2026-11-08','2026-11-15'];
const discussionTitles = [
  ['1.1 Analyzing Relationships','1.2 Intimate Partner Violence (IPV)'],
  ['2.1 Reflections of Self-Identity'],
  ['3.1 Honouring Culture While Reshaping Structure','3.2 Video Reflections'],
  ["4.1 The Therapist’s Role: Not-Knowing but Hope-Oriented"],
  ['5.1 Learning Reflections: Putting It All Together']
];
const chapters = [[1,3,4,6],[7,8],[9,10,11],[13,14],[12,15,16]];
const resources = [
  [ ['article','Abela et al. (2024) — Safe Doors, Safe Homes and IPV prevention'], ['article','Black et al. (2025) — Children’s exposure to IPV'], ['article','Daneshpour (2025) — Couples therapy, trust, fairness and justice'], ['article','Lebow & Snyder (2022) — Couples therapy developments'], ['article','Ogden & Tutty (2023) — IPV against Indigenous women and colonialism'], ['resource','Canadian Women’s Foundation — Signal for Help'] ],
  [ ['article','Brown & Errington (2024) — Bowen Family Systems Theory'], ['podcast','Gabor Maté — How Our Childhood Shapes Every Aspect of Our Lives',true] ],
  [ ['video','Structural Family Therapy demonstration'], ['article','Greenberg & Watson (2022) — Emotion-Focused Therapy'], ['article','Kula et al. (2024) — Vulnerability sharing in Emotion-Focused Couple Therapy'], ['article','Pender Baum & Pender (2023) — Structural Family Therapy'], ['video','Sue Johnson — Emotion-Focused Couples Therapy'] ],
  [ ['article','Arora & Jose (2024) — Solution-Focused Brief Therapy'], ['video','Insoo Kim Berg — Couples therapy'], ['video','Insoo Kim Berg — Family therapy'], ['article','Zak & Pekala (2025) — Effectiveness of SFBT'], ['article','Zatloukal (2025) — Preferred futures in SFBT'] ],
  [ ['article','Maqrdani & Navabinejad (2023) — Gottman approach'], ['article','Naeem et al. (2023) — Culturally adapted CBT'], ['video','Couples Therapy with Angry Couples'], ['video','Gottman — Four Horsemen'], ['video','Julie Gottman — Therapy demonstration'] ]
];
export const COURSE = {
  id:'psyc6263-2026-fall', student:'Beyza', code:'PSYC 6263', title:'Couples & Family Systems', university:'Yorkville University', program:'Master of Arts in Counselling Psychology',
  instructor:'Dr. Amira Sheikh, PsyD., LMFT', email:'asheikh@yorkvilleu.ca', start:'2026-10-12', end:'2026-11-15',
  textbook:'Goldenberg, I., Stanton, M., & Goldenberg, H. (2016). Family Therapy: An Overview (9th ed.). Brooks-Cole.',
  units:unitStarts.map((start,i)=>({id:i+1,start,end:unitEnds[i],discussions:discussionTitles[i].map(title=>({id:title.split(' ')[0],title:title.slice(4)})),readings:[...chapters[i].map(chapter=>({id:`u${i+1}-chapter-${chapter}`,title:`Family Therapy: An Overview — Chapter ${chapter}`,author:'Goldenberg, Stanton & Goldenberg (2016)',type:'chapter',optional:false})),...resources[i].map(([type,title,optional],j)=>({id:`u${i+1}-resource-${j+1}`,title,type,optional:!!optional,url:''}))]})),
  assignments:[
    {id:'genogram',title:'Genogram Project',dueDate:'2026-10-25',dueTime:'23:55',zone:'America/Halifax',weight:30,requirements:['Genogram drawing covering at least three generations','Written narrative: 8–10 double-spaced pages, approximately 2,000–2,500 words','3–5 peer-reviewed research articles; APA 7 formatting','Analyze using Bowen Family Systems Theory OR Minuchin’s Structural Family Therapy'],format:'Genogram drawing and written narrative; exact file type not supplied.',references:'3–5 peer-reviewed research articles',milestones:[]},
    {id:'case-study',title:'Case Study Paper',dueDate:'2026-11-08',dueTime:'23:55',zone:'America/Halifax',weight:35,requirements:['Group of 3–5 students','Simulated couple or family counselling session; each student acts as counsellor for 20–30 minutes','Video recording; include the video link in the final paper','8–10 double-spaced pages, approximately 2,000–2,500 words','Minimum 3–5 peer-reviewed research articles; APA 7 formatting','Theory-based case conceptualization and treatment plan','Reflection on counselling strengths, weaknesses and model effectiveness'],format:'Written paper including a link to the session recording; exact file type not supplied.',references:'Minimum 3–5 peer-reviewed research articles',milestones:['case-signup','coordination','recording']},
    {id:'journal',title:'Seminar Discussion and Learning Journal',dueDate:'2026-11-15',dueTime:'23:55',zone:'America/Halifax',weight:10,requirements:['Group of 3–5 students','Group seminar during Unit 5, using Zoom or Microsoft Teams','Written learning journal: 4–5 double-spaced pages, approximately 1,000–1,250 words','3–5 references; APA 7 formatting','Meeting date and link to be configured; no meeting time has been assumed'],format:'Written learning journal and group seminar; exact file type not supplied.',references:'3–5 references',milestones:['seminar-signup','seminar-meeting']}
  ],
  grading:[{id:'discussions',title:'Discussions',weight:25},{id:'genogram',title:'Genogram Project',weight:30},{id:'case-study',title:'Case Study Paper',weight:35},{id:'journal',title:'Seminar & Learning Journal',weight:10}],
  milestones:[
    {id:'case-signup',title:'Case Study group sign-up',date:'2026-10-18',kind:'deadline'},
    {id:'seminar-signup',title:'Seminar group sign-up',date:'2026-10-18',kind:'deadline'},
    {id:'coordination',title:'Coordinate Case Study group',window:['2026-10-12','2026-11-08']},
    {id:'recording',title:'Record the counselling role-play',window:['2026-10-12','2026-11-08']},
    {id:'seminar-meeting',title:'Group seminar meeting',window:['2026-11-09','2026-11-15']},
    {id:'survey',title:'Complete end-of-course survey',window:['2026-11-09','2026-11-15']},
    {id:'save-work',title:'Save submitted and graded coursework',window:['2026-11-09','2026-11-15']}
  ],
  links:[{id:'brightspace',title:'Brightspace',url:'https://learn.mycourses.ca/'},{id:'library',title:'University library',url:''},{id:'email',title:'University email',url:''},{id:'syllabus',title:'Course syllabus',url:''},{id:'apa',title:'APA 7 resources',url:'https://apastyle.apa.org/'},{id:'zotero',title:'Zotero',url:''}],
  sourceNote:'Course details supplied by you. Full source documents were not attached; resource titles are brief descriptions, not complete citations. Unavailable links remain unconfigured.'
};
