const K='salescrm_v2',$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const DEF_STAGES=['New','Contacted','Callback','Quoted','Won','Lost'];
const SOURCES=['Facebook','Google','Instagram','Flyer','Referral','Vehicle Wrap','Lead Finder','Other'];
const JOBBER_SOURCES=['Facebook','Google','Instagram','Flyer','Referral','Vehicle Wrap','Other'];
const uid=()=>Math.random().toString(36).slice(2,10);
const day=(n=0)=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const today=()=>day(0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=l=>[l.first,l.last].filter(Boolean).join(' ')||l.company||'(no name)';
const closed=l=>/won|lost/i.test(l.stage);
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.remove('hide');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.add('hide'),2200)};
const DEF_TPL=[
 {id:'t1',kind:'call',title:'Cold call opener',body:'Hi {first}, it\'s Abraham with {mycompany}. I work with {category} around {city} on heating, cooling and maintenance. Who looks after that for {company}?'},
 {id:'t2',kind:'sms',title:'After voicemail (text)',body:'Hi {first}, Abraham from {mycompany} here. Just left you a voicemail about {company}. Happy to send a free quote. Reply STOP to opt out.'},
 {id:'t3',kind:'email',title:'Quote follow-up',subject:'Your quote from {mycompany}',body:'Hi {first},\n\nFollowing up on the quote for {company}. Any questions I can answer?\n\nThanks,\nAbraham\n{mycompany}\n\nIf you would rather not hear from me, just reply and let me know.'}];
const DEF_SEQ=[{d:1,t:'Call: intro'},{d:3,t:'Text: follow-up'},{d:7,t:'Email: check-in / quote'}];
function seed(){const L=(f,l,c,ph,st,cb,src,city,v,tags,n)=>({id:uid(),example:true,first:f,last:l,company:c,email:(f+'@example.com').toLowerCase(),phone:ph,website:'',street:'123 Example St',city,prov:'BC',postal:'V0X 0X0',country:'Canada',source:src,tags,value:v,stage:st,callback:cb,notes:n,calls:[],tasks:[],created:day(-10),pushed:false});
 const leads=[
 L('Example','Homeowner','','604-555-0101','New','','Google','Langley',4500,'residential','EXAMPLE LEAD: web form, wants furnace quote'),
 L('Sample','Builder','Sample Homes Ltd','604-555-0102','Contacted',day(0),'Referral','Surrey',18000,'builder,hot','EXAMPLE LEAD: 3-unit build'),
 L('Test','Property','Test Strata Mgmt','604-555-0103','Callback',day(-2),'Flyer','Abbotsford',9000,'strata','EXAMPLE LEAD: call back after board meeting'),
 L('Demo','Client','','604-555-0104','Quoted',day(3),'Facebook','Chilliwack',6200,'residential','EXAMPLE LEAD: quote sent'),
 L('Placeholder','Owner','Placeholder Cafe','604-555-0105','Won','','Instagram','Mission',3100,'restaurant','EXAMPLE LEAD: signed'),
 L('Fake','Prospect','','604-555-0106','Lost','','Other','Maple Ridge',2500,'','EXAMPLE LEAD: went with competitor'),
 L('Mock','Manager','Mock Seniors Residence','604-555-0107','Callback',day(0),'Lead Finder','Fort Langley',7400,'retirement','EXAMPLE LEAD: ask for facilities manager')];
 leads[1].tasks=[{id:uid(),due:day(0),t:'Text: follow-up',done:false}];leads[3].tasks=[{id:uid(),due:day(-1),t:'Email: check-in / quote',done:false}];
 return{stages:[...DEF_STAGES],leads,done:[],tpl:DEF_TPL,seq:DEF_SEQ,mycompany:'Wavelength Solutions',tab:'today'}}
let S;
function load(){try{const d=JSON.parse(localStorage.getItem(K));if(d)return Object.assign(seed(),{leads:[]},d)}catch(e){}return seed()}
function save(){localStorage.setItem(K,JSON.stringify(S));render()}
const lead=id=>S.leads.find(x=>x.id===id);
function fill(s,l){return String(s||'').replace(/\{(\w+)\}/g,(m,k)=>k==='mycompany'?S.mycompany:k==='category'?((l.tags||'').split(',').find(t=>/restaurant|strata|retirement|builder|residential/.test(t))||'businesses'):k==='first'?(l.first||'there'):(l[k]||''))}
function filtered(){const q=$('#q').value.toLowerCase(),src=$('#fsrc').value,tg=$('#ftag').value;
 return S.leads.filter(l=>(!src||l.source===src)&&(!tg||(l.tags||'').split(',').map(x=>x.trim()).includes(tg))&&(!q||JSON.stringify(l).toLowerCase().includes(q)))}
const allTags=()=>[...new Set(S.leads.flatMap(l=>(l.tags||'').split(',').map(x=>x.trim()).filter(Boolean)))].sort();
function opts(el,first,list){const c=el.value;el.innerHTML=`<option value="">${first}</option>`+list.map(s=>`<option ${s===c?'selected':''}>${esc(s)}</option>`).join('')}
const STC={new:'#6366f1',contacted:'#0ea5e9',callback:'#f59e0b',quoted:'#a855f7','site visit':'#14b8a6',won:'#16a34a',lost:'#9ca3af'};
const stc=s=>STC[String(s).toLowerCase()]||'#64748b';
function render(){
 opts($('#fsrc'),'All sources',SOURCES);opts($('#ftag'),'All tags',allTags());
 $$('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===S.tab));['today','board','finder','templates','settings'].forEach(t=>$('#v-'+t).classList.toggle('hide',t!==S.tab));$('#stats').classList.toggle('hide',!['today','board'].includes(S.tab));
 const wk=day(-7),done=S.done.filter(d=>d>=wk).length,won=S.leads.filter(l=>/won/i.test(l.stage)).length,lost=S.leads.filter(l=>/lost/i.test(l.stage)).length;
 const open=S.leads.filter(l=>!closed(l)).reduce((a,l)=>a+(+l.value||0),0);
 $('#stats').innerHTML=[['Leads',S.leads.length],['Follow-ups done (7d)',done],['Win rate',won+lost?Math.round(100*won/(won+lost))+'%':'—'],['Open pipeline $',open.toLocaleString()]].map(([k,v])=>`<div class="stat"><b>${v}</b><small>${k}</small></div>`).join('')+`<div class="stat"><small>By stage</small><div class="bars">${S.stages.map(s=>`<span class="sc" style="--c:${stc(s)}"><i></i>${esc(s)} ${S.leads.filter(l=>l.stage===s).length}</span>`).join('')}</div></div>`;
 renderToday();renderBoard();if(!$('#v-finder').innerHTML)renderFinder();renderTemplates();if(window.renderSettings)renderSettings();}
function renderToday(){const t=today(),F=filtered();
 const cbs=F.filter(l=>l.callback&&l.callback<=t&&!closed(l)).sort((a,b)=>a.callback.localeCompare(b.callback));
 const tasks=F.flatMap(l=>(l.tasks||[]).filter(k=>!k.done&&k.due<=t&&!closed(l)).map(k=>({l,k}))).sort((a,b)=>a.k.due.localeCompare(b.k.due));
 const up=F.flatMap(l=>(l.tasks||[]).filter(k=>!k.done&&k.due>t&&k.due<=day(7)).map(k=>({l,k})).concat(l.callback>t&&l.callback<=day(7)&&!closed(l)?[{l,k:{due:l.callback,t:'Callback'}}]:[])).sort((a,b)=>a.k.due.localeCompare(b.k.due));
 const badge=d=>`<span class="tag ${d<t?'over':'today'}">${d<t?'Overdue '+d:'Today'}</span>`;
 $('#v-today').innerHTML=`<div class="panel duebox" id="duebox"><h2>Callbacks: ${cbs.length?cbs.length+' due today / overdue':'all caught up'}</h2>${cbs.length?'':'<div class="empty">No callbacks due. Nice work.</div>'}${cbs.map(l=>`<div class="dueitem"><span class="chk"></span>${badge(l.callback)}<b>${esc(name(l))}</b><a href="tel:${esc(l.phone)}">${esc(l.phone)}</a><span class="sc" style="--c:${stc(l.stage)}"><i></i>${esc(l.stage)}</span><button onclick="openCall('${l.id}')">Log call</button></div>`).join('')}</div>
 <div class="panel" id="taskbox"><h2>Sequence tasks: ${tasks.length} due</h2>${tasks.map(({l,k})=>`<div class="dueitem"><span class="chk"></span>${badge(k.due)}<b>${esc(k.t)} — ${esc(name(l))}</b><button onclick="contact('${l.id}')">Templates</button><button class="ok" onclick="doneTask('${l.id}','${k.id}')">Done</button></div>`).join('')||'<div class="empty">No tasks due. Start a sequence from a lead (Edit → Start sequence).</div>'}</div>
 <div class="panel"><h2>Next 7 days</h2>${up.map(({l,k})=>`<div class="dueitem"><span class="tag">${k.due}</span><b>${esc(k.t)} — ${esc(name(l))}</b></div>`).join('')||'<div class="empty">Nothing scheduled in the next 7 days.</div>'}</div>`}
function card(l){const t=today();return `<div class="card" draggable="true" data-id="${l.id}"><div class="n">${esc(name(l))}${l.example?'<span class="ex">EXAMPLE</span>':''}${l.value?`<span class="v">$${(+l.value).toLocaleString()}</span>`:''}</div><div class="s">${esc(l.company)}</div><div>${(l.tags||'').split(',').filter(x=>x.trim()).map(x=>`<span class="tg">${esc(x.trim())}</span>`).join('')}</div>${l.callback?`<div class="s">📅 ${l.callback}${l.callback<t&&!closed(l)?' <span class="tag over">overdue</span>':''}</div>`:''}<div class="row">${l.phone?`<a class="q" href="tel:${esc(l.phone)}" title="Call">☎ Call</a><a class="q" href="sms:${esc(l.phone)}" title="Text">✆ Text</a>`:''}<button onclick="moveMenu('${l.id}')">Move</button><button onclick="openCall('${l.id}')">Log</button><button onclick="contact('${l.id}')">✉ Contact</button><button onclick="edit('${l.id}')">Edit</button>${l.callback?`<button onclick="ics('${l.id}')">.ics</button>`:''}${/won/i.test(l.stage)?`<button class="ok" onclick="push('${l.id}')">${l.pushed?'✓ Pushed':'Push to Jobber'}</button>`:''}</div></div>`}
function renderBoard(){const F=filtered();
 $('#v-board').innerHTML=S.stages.map(s=>{const ls=F.filter(l=>l.stage===s);const tot=ls.reduce((a,l)=>a+(+l.value||0),0);return `<div class="col" data-stage="${esc(s)}" style="--c:${stc(s)}"><h3><i></i>${esc(s)}<span class="n">${ls.length}</span><span class="sum">${tot?'$'+tot.toLocaleString():''}</span></h3><div class="list">${ls.map(card).join('')}</div></div>`}).join('');
 $$('.card').forEach(c=>{c.ondragstart=e=>e.dataTransfer.setData('text',c.dataset.id);
  let tm;c.addEventListener('touchstart',()=>{tm=setTimeout(()=>moveMenu(c.dataset.id),550)},{passive:true});['touchend','touchmove','touchcancel'].forEach(ev=>c.addEventListener(ev,()=>clearTimeout(tm),{passive:true}))});
 $$('.col').forEach(c=>{c.ondragover=e=>{e.preventDefault();c.classList.add('drag')};c.ondragleave=()=>c.classList.remove('drag');c.ondrop=e=>{e.preventDefault();setStage(e.dataTransfer.getData('text'),c.dataset.stage)}})}
function setStage(id,st){const l=lead(id);if(!l||l.stage===st)return;l.stage=st;if(closed(l))(l.tasks||[]).forEach(k=>k.done=k.done||'cancelled');save();toast(name(l)+' → '+st);if(/won/i.test(st))push(id)}
function moveMenu(id){const l=lead(id);$('#d2').innerHTML=`<h2>Move ${esc(name(l))}</h2><div class="stagepick">${S.stages.map(s=>`<button data-s="${esc(s)}" class="${s===l.stage?'pri':''}">${esc(s)}</button>`).join('')}<button onclick="$('#dlg2').close()">Cancel</button></div>`;
 $$('#d2 [data-s]').forEach(b=>b.onclick=()=>{$('#dlg2').close();setStage(id,b.dataset.s)});$('#dlg2').showModal()}
function startSeq(l){l.tasks=l.tasks||[];S.seq.forEach(s=>l.tasks.push({id:uid(),due:day(s.d),t:s.t,done:false}));toast('Sequence started: '+S.seq.length+' tasks')}
function doneTask(lid,tid){const l=lead(lid),k=l.tasks.find(x=>x.id===tid);k.done=today();S.done.push(today());save();toast('Task done')}
const FIELDS=[['first','First name'],['last','Last name'],['company','Company'],['phone','Phone'],['email','Email'],['website','Website'],['value','Est. value $'],['tags','Tags (comma sep.)'],['street','Street'],['city','City'],['prov','Province'],['postal','Postal code'],['country','Country']];
function edit(id){const l=id?lead(id):{id:uid(),stage:S.stages[0],country:'Canada',prov:'BC',calls:[],tasks:[],created:today(),source:'Other',tags:''};
 $('#form').innerHTML=`<h2>${id?'Edit lead':'New lead'}</h2><div class="grid">${FIELDS.map(([k,t])=>`<div><label>${t}</label><input name="${k}" value="${esc(l[k])}"></div>`).join('')}
 <div><label>Lead source</label><select name="source">${SOURCES.map(s=>`<option ${s===l.source?'selected':''}>${s}</option>`).join('')}</select></div>
 <div><label>Stage</label><select name="stage">${S.stages.map(s=>`<option ${s===l.stage?'selected':''}>${esc(s)}</option>`).join('')}</select></div>
 <div><label>Next callback</label><input type="date" name="callback" value="${l.callback||''}"></div>
 <div><label><input type="checkbox" name="seq" style="width:auto"> Start follow-up sequence (${S.seq.map(s=>'day '+s.d).join('/')})</label></div>
 <div class="full"><label>Notes</label><textarea name="notes" rows="3">${esc(l.notes)}</textarea></div></div>
 ${(l.tasks||[]).length?'<h4>Tasks</h4><div class="log">'+l.tasks.map(k=>`<div>${k.due} — ${esc(k.t)} ${k.done?'✓':''}</div>`).join('')+'</div>':''}
 ${(l.calls||[]).length?'<h4>Call history</h4><div class="log">'+l.calls.slice().reverse().map(c=>`<div>${c.at.slice(0,16).replace('T',' ')} — <b>${esc(c.outcome)}</b> ${esc(c.note)}</div>`).join('')+'</div>':''}
 <div class="acts">${id?'<button value="del" class="danger">Delete</button>':''}<button value="cancel">Cancel</button><button value="save" class="pri" id="savebtn">Save</button></div>`;
 const d=$('#dlg');d.onclose=()=>{const fd=new FormData($('#form'));
  if(d.returnValue==='save'){const old=l.stage;for(const[k,v]of fd)if(k!=='seq')l[k]=v;if(fd.get('seq'))startSeq(l);if(!id)S.leads.push(l);save();if(/won/i.test(l.stage)&&old!==l.stage||(!id&&/won/i.test(l.stage)))push(l.id)}
  if(d.returnValue==='del'&&confirm('Delete this lead?')){S.leads=S.leads.filter(x=>x.id!==id);save()}};d.returnValue='';d.showModal()}
function openCall(id){const l=lead(id);
 $('#form').innerHTML=`<h2>Log call — ${esc(name(l))}</h2><a href="tel:${esc(l.phone)}">${esc(l.phone)}</a><label>Outcome</label><div class="qc">${['No answer','Left voicemail','Talked','Call back later','Quote requested','Not interested'].map(o=>`<label><input type="radio" name="outcome" value="${o}" style="width:auto" ${o==='No answer'?'checked':''}>${o}</label>`).join('')}</div>
 <label>Note</label><input name="note"><label>Next callback (one tap saves)</label><div class="qc"><button value="1" class="pri">Tomorrow</button><button value="3" class="pri">3 days</button><button value="7" class="pri">1 week</button><button value="none">No callback</button><button value="cancel">Cancel</button></div>`;
 const d=$('#dlg');d.onclose=()=>{const r=d.returnValue;if(!r||r==='cancel')return;const fd=new FormData($('#form')),o=fd.get('outcome');
  l.calls=l.calls||[];l.calls.push({at:new Date().toISOString(),outcome:o,note:fd.get('note')});S.done.push(today());
  l.callback=r==='none'?'':day(+r);const f=re=>S.stages.find(s=>re.test(s));
  if(/^new$/i.test(l.stage))l.stage=f(/contacted/i)||l.stage;if(o==='Call back later'&&r!=='none')l.stage=f(/callback/i)||l.stage;
  if(o==='Quote requested')l.stage=f(/quoted/i)||l.stage;if(o==='Not interested'){l.stage=f(/lost/i)||l.stage;l.callback=''}
  save();toast('Call logged'+(l.callback?' · callback '+l.callback:''))};d.returnValue='';d.showModal()}
const digits=p=>String(p||'').replace(/[^\d+]/g,'');
function links(t,l){const b=fill(t.body,l);if(t.kind==='sms')return `<a class="btnlike" href="sms:${digits(l.phone)}?&body=${encodeURIComponent(b)}">Open in Messages</a>`;
 if(t.kind==='email')return `<a class="btnlike" href="mailto:${encodeURIComponent(l.email||'')}?subject=${encodeURIComponent(fill(t.subject,l))}&body=${encodeURIComponent(b)}">Open in Mail</a>`;return `<a class="btnlike" href="tel:${digits(l.phone)}">Call ${esc(l.phone)}</a>`}
function contact(id){const l=lead(id);$('#d2').innerHTML=`<h2>Contact ${esc(name(l))}</h2><p class="muted">Opens your own phone/mail app with the message filled in. Nothing is sent automatically.</p>${S.tpl.map(t=>`<div class="tpl"><b>${esc(t.title)}</b> <span class="tag">${t.kind}</span>${t.subject?`<div class="muted">Subject: ${esc(fill(t.subject,l))}</div>`:''}<pre>${esc(fill(t.body,l))}</pre><div class="qc"><button data-c="${t.id}">Copy</button>${links(t,l)}</div></div>`).join('')}<div class="acts"><button onclick="$('#dlg2').close()">Close</button></div>`;
 $$('#d2 [data-c]').forEach(b=>b.onclick=()=>{const t=S.tpl.find(x=>x.id===b.dataset.c);navigator.clipboard?.writeText(fill(t.body,l)).catch(()=>{});toast('Copied')});$('#dlg2').showModal()}
function renderTemplates(){$('#v-templates').innerHTML=`<div class="panel"><h2>Message templates</h2><p class="muted">Placeholders: {first} {company} {city} {category} {mycompany}. Templates only open your phone or mail app (tel:/sms:/mailto:) and never auto-send. CASL: only email or text businesses where you have implied consent (published business contact relevant to their role) and always include an opt-out.</p>
 <label>Your company name</label><input id="myco" value="${esc(S.mycompany)}">
 ${S.tpl.map(t=>`<div class="tpl" data-id="${t.id}"><div class="grid"><div><label>Title</label><input data-f="title" value="${esc(t.title)}"></div><div><label>Type</label><select data-f="kind">${['call','sms','email'].map(k=>`<option ${k===t.kind?'selected':''}>${k}</option>`).join('')}</select></div>${t.kind==='email'?`<div class="full"><label>Subject</label><input data-f="subject" value="${esc(t.subject)}"></div>`:''}<div class="full"><label>Body</label><textarea data-f="body" rows="3">${esc(t.body)}</textarea></div></div><button class="danger" data-del="${t.id}">Delete</button></div>`).join('')}
 <div class="acts"><button id="tadd">+ Template</button><button id="tsave" class="pri">Save templates</button></div></div>
 <div class="panel"><h2>Follow-up sequence</h2><p class="muted">Tasks created when you tick "Start follow-up sequence" on a lead, or press "Start sequence" on Lead Finder results.</p>${S.seq.map(s=>`<div>Day ${s.d}: ${esc(s.t)}</div>`).join('')}<div class="acts"><button onclick="editSeq()">Edit sequence</button></div></div>`;
 $('#tadd').onclick=()=>{S.tpl.push({id:uid(),kind:'sms',title:'New template',body:''});save()};
 $$('[data-del]').forEach(b=>b.onclick=()=>{S.tpl=S.tpl.filter(t=>t.id!==b.dataset.del);save()});
 $('#tsave').onclick=()=>{S.mycompany=$('#myco').value;$$('.tpl[data-id]').forEach(el=>{const t=S.tpl.find(x=>x.id===el.dataset.id);el.querySelectorAll('[data-f]').forEach(i=>t[i.dataset.f]=i.value)});save();toast('Templates saved')}}
function editSeq(){const v=prompt('Sequence as "day:task" separated by ; e.g. 1:Call;3:Text;7:Email',S.seq.map(s=>s.d+':'+s.t).join(';'));if(v){S.seq=v.split(';').map(x=>{const[d,...t]=x.split(':');return{d:+d,t:t.join(':').trim()}}).filter(s=>s.d>=0&&s.t);save()}}
// ---- Lead Finder (OpenStreetMap Overpass, public business listings only)
const AREAS={'Fort Langley':[49.150,-122.600,49.180,-122.560],'Langley (City + Township)':[49.000,-122.680,49.230,-122.450],'Surrey':[49.000,-122.920,49.220,-122.680],'Lower Mainland':[49.000,-123.300,49.400,-122.200]};
const CATS={'Restaurants & cafes':['nwr["amenity"~"^(restaurant|cafe|fast_food|pub|bar)$"]'],
 'Retirement / senior homes':['nwr["amenity"="nursing_home"]','nwr["social_facility"~"^(assisted_living|nursing_home|group_home)$"]','nwr["social_facility:for"~"senior"]','nwr["healthcare"="nursing_home"]'],
 'Strata / property management (residential)':['nwr["office"="property_management"]','nwr["office"="estate_agent"]','nwr["office"="company"]["name"~"[Ss]trata|[Pp]roperty"]'],
 'Builders & trades':['nwr["craft"~"^(hvac|plumber|electrician|roofer|builder)$"]','nwr["office"="construction_company"]']};
const CATTAG={'Restaurants & cafes':'restaurant','Retirement / senior homes':'retirement','Strata / property management (residential)':'strata','Builders & trades':'builder'};
const SERVERS=['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
let FR=[];
function renderFinder(){$('#v-finder').innerHTML=`<div class="panel"><h2>Lead Finder</h2><p class="muted">Free public business listings from OpenStreetMap (© OpenStreetMap contributors, ODbL). Businesses only, no private individuals. For residential work, target strata corporations and property managers. Coverage varies: OSM is volunteer-mapped, so phone numbers are often missing.</p>
 <div class="grid"><div><label>Category</label><select id="fcat">${Object.keys(CATS).map(c=>`<option>${c}</option>`).join('')}</select></div><div><label>Area</label><select id="farea">${Object.keys(AREAS).map(a=>`<option ${a.startsWith('Langley')?'selected':''}>${a}</option>`).join('')}</select></div>
 <div><label>Name contains (optional)</label><input id="fname"></div><div><label><input type="checkbox" id="fphone" style="width:auto"> Only with phone</label></div></div>
 <div class="acts"><button id="fgo" class="pri">Search</button></div><div id="fstatus" class="muted"></div></div><div class="panel" id="fres"></div>`;
 $('#fgo').onclick=finderSearch}
async function overpass(q){let w=2000;for(let i=0;i<6;i++){const u=SERVERS[i%SERVERS.length];try{$('#fstatus').textContent=`Searching… (${new URL(u).host}, try ${i+1})`;const ac=new AbortController(),to=setTimeout(()=>ac.abort(),45000);const r=await fetch(u,{signal:ac.signal,method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'}});clearTimeout(to);if(r.ok)return await r.json();}catch(e){}await new Promise(r=>setTimeout(r,w));w*=2}throw new Error('Overpass servers busy, try again in a minute')}
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const isDup=r=>S.leads.some(l=>norm(l.company||name(l))===norm(r.company)&&(!r.street||!l.street||norm(l.street)===norm(r.street))||(r.phone&&digits(l.phone).slice(-10)===digits(r.phone).slice(-10)));
async function finderSearch(){const cat=$('#fcat').value,[s,w,n,e]=AREAS[$('#farea').value],bb=`(${s},${w},${n},${e})`;
 const q='[out:json][timeout:60];('+CATS[cat].map(x=>x+bb+';').join('')+');out tags center;';$('#fres').innerHTML='';
 try{const d=await overpass(q),seen=new Set();FR=[];
  for(const el of d.elements||[]){const t=el.tags||{};if(!t.name)continue;const k=norm(t.name)+norm(t['addr:street']);if(seen.has(k))continue;seen.add(k);
   FR.push({company:t.name,phone:t.phone||t['contact:phone']||'',email:t.email||t['contact:email']||'',website:t.website||t['contact:website']||'',street:[t['addr:housenumber'],t['addr:street']].filter(Boolean).join(' '),city:t['addr:city']||'',postal:t['addr:postcode']||'',osm:el.type+'/'+el.id,cat:CATTAG[cat]})}
  const nf=norm($('#fname').value);FR=FR.filter(r=>(!nf||norm(r.company).includes(nf))&&(!$('#fphone').checked||r.phone));FR.forEach(r=>r.dup=isDup(r));
  $('#fstatus').textContent=`${FR.length} found · ${FR.filter(r=>r.phone).length} with phone · ${FR.filter(r=>r.dup).length} already in pipeline`;showResults()}
 catch(err){$('#fstatus').textContent=err.message}}
function showResults(){$('#fres').innerHTML=FR.length?`<div class="acts" style="justify-content:flex-start"><button id="fall">Select all new</button><button id="fimp" class="pri">Import selected as New leads</button><label><input type="checkbox" id="fseq" style="width:auto"> + start sequence</label></div>
 <table><tr><th></th><th>Name</th><th>Phone</th><th>Address</th><th>Website</th></tr>${FR.map((r,i)=>`<tr class="${r.dup?'dup':''}"><td><input type="checkbox" data-i="${i}" ${r.dup?'disabled':''} style="width:auto"></td><td>${esc(r.company)}${r.dup?' <span class="tag">in pipeline</span>':''}</td><td>${esc(r.phone)}</td><td>${esc(r.street)} ${esc(r.city)}</td><td>${r.website?`<a href="${esc(r.website)}" target="_blank" rel="noopener">site</a>`:''}</td></tr>`).join('')}</table>`:'<div class="muted">No results.</div>';
 if(!FR.length)return;$('#fall').onclick=()=>$$('#fres [data-i]:not(:disabled)').forEach(c=>c.checked=true);
 $('#fimp').onclick=()=>{let n=0;$$('#fres [data-i]:checked').forEach(c=>{const r=FR[+c.dataset.i];if(isDup(r))return;const l={id:uid(),first:'',last:'',company:r.company,phone:r.phone,email:r.email,website:r.website,street:r.street,city:r.city,prov:'BC',postal:r.postal,country:'Canada',source:'Lead Finder',tags:'finder,'+r.cat,stage:S.stages[0],callback:'',notes:'Found via OpenStreetMap osm:'+r.osm,calls:[],tasks:[],created:today()};if($('#fseq').checked)startSeq(l);S.leads.push(l);r.dup=true;n++});save();showResults();toast(n+' leads imported')}}
// ---- Jobber push, ICS, CSV
const JH=['Client Is Company?','Client First Name','Client Last Name','Client Company Name','Client Email','Client Main Phone','Property Street 1','Property City','Property State/Province','Property Zip/Postal Code','Property Country','Client Internal Notes','Lead Source','Tags'];
const csvq=v=>{v=String(v??'');return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const toCSV=(h,rows)=>[h,...rows].map(r=>r.map(csvq).join(',')).join('\r\n');
const jrow=l=>[l.company?'TRUE':'FALSE',l.first,l.last,l.company,l.email,l.phone,l.street,l.city,l.prov,l.postal,l.country,(l.notes||'')+(l.value?` | Est. value $${l.value}`:''),JOBBER_SOURCES.includes(l.source)?l.source:'Other',['Sales CRM',...(l.tags||'').split(',').map(x=>x.trim()).filter(Boolean)].join(', ')];
function dl(fn,txt,type='text/csv'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type}));a.download=fn;document.body.appendChild(a);a.click();a.remove()}
function push(id){const l=lead(id),csv=toCSV(JH,[jrow(l)]);
 $('#d2').innerHTML=`<h2>Won 🎉 Push ${esc(name(l))} to Jobber</h2><p>Only won deals go into Jobber, so the company client list stays clean. In Jobber: <b>Clients → More Actions → Import Clients</b>, upload this CSV.</p><pre id="jcsv">${esc(csv)}</pre>
 <div class="acts"><button id="cp">Copy</button><button id="dj" class="pri">Download CSV</button><button id="mk" class="ok">Mark as pushed</button><button onclick="$('#dlg2').close()">Close</button></div>`;
 $('#cp').onclick=()=>{navigator.clipboard?.writeText(csv).catch(()=>{});toast('Copied')};$('#dj').onclick=()=>dl(`jobber-client-${norm(l.company||l.last)||'lead'}.csv`,csv);$('#mk').onclick=()=>{l.pushed=true;save();$('#dlg2').close()};$('#dlg2').showModal()}
function ics(id){const l=lead(id),d=l.callback.replace(/-/g,''),e=s=>String(s||'').replace(/[\\;,]/g,m=>'\\'+m).replace(/\n/g,'\\n');
 const t=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SalesCRM//EN\r\nBEGIN:VEVENT\r\nUID:${l.id}-${d}@salescrm\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').slice(0,15)}Z\r\nDTSTART:${d}T090000\r\nDTEND:${d}T091500\r\nSUMMARY:${e('Call back '+name(l)+(l.company&&l.first?' ('+l.company+')':''))}\r\nDESCRIPTION:${e('Phone '+l.phone+'\n'+(l.notes||''))}\r\nBEGIN:VALARM\r\nTRIGGER:-PT10M\r\nACTION:DISPLAY\r\nDESCRIPTION:Callback\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
 dl(`callback-${norm(name(l))}.ics`,t,'text/calendar')}
const LH=['first','last','company','phone','email','website','value','street','city','prov','postal','country','source','tags','stage','callback','notes'];
function parseCSV(t){const R=[];let r=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c=='"'){if(t[i+1]=='"'){f+='"';i++}else q=false}else f+=c}else if(c=='"')q=true;else if(c==','){r.push(f);f=''}else if(c=='\n'||c=='\r'){if(c=='\r'&&t[i+1]=='\n')i++;r.push(f);R.push(r);r=[];f=''}else f+=c}if(f||r.length){r.push(f);R.push(r)}return R.filter(x=>x.some(Boolean))}
function importCSV(text){const rows=parseCSV(text.replace(/^\uFEFF/,'')),h=rows.shift().map(x=>x.trim().toLowerCase());let n=0,skip=0;
 rows.forEach(r=>{const l={id:uid(),calls:[],tasks:[],created:today()};LH.forEach(k=>{const i=h.indexOf(k);l[k]=i>=0?r[i]:''});if(!S.stages.includes(l.stage))l.stage=S.stages[0];if(!SOURCES.includes(l.source))l.source='Other';
  if(isDup({company:name(l),street:l.street,phone:l.phone})){skip++;return}S.leads.push(l);n++});save();return{n,skip}}
function notify(){if(!('Notification'in window)||Notification.permission!=='granted')return;const t=today();
 S.leads.filter(l=>!closed(l)&&(l.callback&&l.callback<=t||(l.tasks||[]).some(k=>!k.done&&k.due<=t))).forEach(l=>{const k='n_'+l.id+t;if(!sessionStorage[k]){sessionStorage[k]=1;new Notification('Follow-up due: '+name(l),{body:l.phone+' '+(l.notes||'')})}})}
function init(){S=load();
 $$('#tabs button').forEach(b=>b.onclick=()=>{S.tab=b.dataset.t;save()});
 $('#add').onclick=()=>edit();$('#q').oninput=render;$('#fsrc').onchange=render;$('#ftag').onchange=render;$('#more').onclick=()=>$('#moremenu').classList.toggle('hide');
 $('#moremenu').onclick=e=>{const a=e.target.dataset.a;if(!a)return;$('#moremenu').classList.add('hide');
  if(a==='exp')dl('leads.csv',toCSV(LH,S.leads.map(l=>LH.map(k=>l[k]))));
  if(a==='stages'){const v=prompt('Stages, comma separated (leads in removed stages move to the first):',S.stages.join(', '));if(v){S.stages=v.split(',').map(s=>s.trim()).filter(Boolean);S.leads.forEach(l=>{if(!S.stages.includes(l.stage))l.stage=S.stages[0]});save()}}
  if(a==='seq')editSeq();if(a==='notif')Notification.requestPermission().then(notify);
  if(a==='seed'&&confirm('Replace all leads with examples?')){S=seed();save()}
  if(a==='wipe'&&confirm('Delete ALL leads?')){S.leads=[];save()}};
 $('#imp').onchange=async e=>{const r=importCSV(await e.target.files[0].text());toast(r.n+' imported, '+r.skip+' duplicates skipped');e.target.value=''};
 render();notify();setInterval(()=>{notify();renderToday()},5*60*1000)}
