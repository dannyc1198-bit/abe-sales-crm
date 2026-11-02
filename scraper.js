// ===== v3 Scraper Agent: pluggable providers, job queue, cost estimate, usage =====
const SK='salescrm_settings'; // kept apart from lead data so exports never include keys
const CFG=Object.assign({server:location.protocol.startsWith('http')&&location.port==='8787'?location.origin:'http://localhost:8787',keys:{},llm:'openai',offer:'commercial HVAC / plumbing service and maintenance'},JSON.parse(localStorage.getItem(SK)||'{}'));
const saveCfg=()=>localStorage.setItem(SK,JSON.stringify(CFG));
// Prices in USD (mirror of COSTS.md, checked 2026-10-30). Estimates ignore free monthly allowances (worst case).
const PRICES={places_text:35/1000,hunter_credit:49/2000,llm:{openai:[0.15,0.60,'gpt-4o-mini'],xai:[1.25,2.50,'grok-4.3'],gemini:[0.10,0.40,'gemini-2.5-flash-lite']}};
const AG_CATS={'Restaurants & cafes':{osm:CATS['Restaurants & cafes'],q:'restaurants',tag:'restaurant'},
 'Strata / property managers':{osm:CATS['Strata / property management (residential)'],q:'strata management company',tag:'strata'},
 'Retirement / senior homes':{osm:CATS['Retirement / senior homes'],q:'retirement home',tag:'retirement'},
 'Custom keyword':{osm:null,q:null,tag:'custom'}};
const AREA_TXT={'Fort Langley':'Fort Langley, BC','Langley (City + Township)':'Langley, BC','Surrey':'Surrey, BC','Lower Mainland':'Lower Mainland, BC'};
const PROVIDERS=[
 {id:'osm',name:'OpenStreetMap (Overpass)',paid:false,step:'source',note:'Free. Business listings mapped by volunteers.'},
 {id:'places',name:'Google Places API (Text Search, contact fields)',paid:true,key:'places',step:'source',note:'Billed per request (up to 20 places each). Enterprise SKU because phone + website are requested.'},
 {id:'web',name:'Business website enrichment',paid:false,step:'enrich',server:true,note:'Free. Fetches the business\'s own homepage and contact page via the backend, obeys robots.txt and waits 2 s or more between hits to the same site.'},
 {id:'hunter',name:'Hunter.io email finder (generic/role emails)',paid:true,key:'hunter',step:'enrich',note:'Only for leads with a website but no email found. No credit is used when nothing is found.'},
 {id:'llm',name:'AI scoring, summary and opening line',paid:true,key:'llm',step:'score',note:'One short call per lead.'}];
const hasKey=p=>p.key==='llm'?!!(CFG.keys[CFG.llm]||SRV.keys?.[CFG.llm]):p.key?!!(CFG.keys[p.key]||SRV.keys?.[p.key]):true;
let SRV={ok:false,keys:{}};
async function health(){const local=/^(localhost|127\.0\.0\.1)$/.test(location.hostname)||location.port==='8787',srvLocal=/localhost|127\.0\.0\.1/.test(CFG.server);if(!local&&srvLocal){SRV={ok:false,keys:{}};return SRV}try{const r=await fetch(CFG.server+'/api/health');SRV=Object.assign({ok:true},await r.json())}catch(e){SRV={ok:false,keys:{}}}return SRV}
async function api(path,body,job,keyName){const h={'Content-Type':'application/json','X-Run-Id':job.id};const k=CFG.keys[keyName];if(k)h['X-Api-Key']=k;
 const r=await fetch(CFG.server+path,{method:'POST',headers:h,body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||('HTTP '+r.status));return d}
function estimate(o){const n=+o.max||0,P=PRICES,L=P.llm[CFG.llm],lines=[];
 if(o.prov.places){const req=Math.ceil(n/20);lines.push(['Google Places Text Search',`${req} request(s) × $${P.places_text.toFixed(3)}`,req*P.places_text])}
 if(o.prov.hunter){const c=Math.ceil(n*0.5);lines.push(['Hunter domain search',`≤${c} credits (assumes about 50% of leads have a site but no email) × $${P.hunter_credit.toFixed(4)}`,c*P.hunter_credit])}
 if(o.prov.llm){const ti=n*700,to=n*150;lines.push([`AI scoring (${L[2]})`,`${n} calls, ~${(ti+to).toLocaleString()} tokens`,(ti*L[0]+to*L[1])/1e6])}
 if(o.prov.osm)lines.push(['OpenStreetMap','free','0']);if(o.prov.web)lines.push(['Website enrichment','free (backend bandwidth only)',0]);
 return{lines,total:lines.reduce((a,l)=>a+(+l[2]||0),0)}}
const money=v=>'$'+(+v).toFixed(v<1?4:2);
function agentForm(){const prov=S.agentProv||{osm:true,web:true};return `<div class="panel" id="agent"><h2>🤖 Scraper Agent</h2>
 <p class="muted">Runs a job through several sources: find businesses, then enrich, then score. Business listings only: no private individuals and no homeowner lists. Paid sources stay switched off until a key is set in Settings or on the server. CASL: these contacts can be called, but email and text only where you have implied consent (published business address, relevant to their role), and always include an opt-out.</p>
 <div class="grid"><div><label>Category</label><select id="acat">${Object.keys(AG_CATS).map(c=>`<option>${c}</option>`).join('')}</select></div>
 <div><label>Custom keyword (e.g. "dental clinic", "hotel")</label><input id="akw" placeholder="only for Custom keyword"></div>
 <div><label>Area</label><select id="aarea">${Object.keys(AREAS).map(a=>`<option ${a.startsWith('Langley')?'selected':''}>${a}</option>`).join('')}</select></div>
 <div><label>Max results</label><input id="amax" type="number" min="1" max="500" value="${S.agentMax||25}"></div></div>
 <h4>Providers</h4><div id="aprov">${PROVIDERS.map(p=>{const avail=hasKey(p)&&(!p.server&&!p.paid||SRV.ok);return `<label style="display:block;margin:4px 0"><input type="checkbox" data-p="${p.id}" style="width:auto" ${prov[p.id]&&avail?'checked':''} ${avail?'':'disabled'}> <b>${p.name}</b> <span class="tag ${p.paid?'today':''}">${p.paid?'paid':'free'}</span> ${avail?'':`<span class="tag over">${p.paid&&!hasKey(p)?'needs API key (Settings)':'needs backend server'}</span>`}<div class="muted">${p.note}</div></label>`}).join('')}</div>
 <div class="panel" id="aest" style="background:#f7f9fb"></div>
 <div class="acts"><span class="muted" id="asrv">${SRV.ok?'✅ Backend connected: '+esc(CFG.server):'⚠ Backend offline. Only the free OSM search works. Start it with <code>python3 server/server.py</code>.'}</span><button id="arun" class="pri">Queue &amp; run job</button></div></div>`}
function readOpts(){const prov={};$$('#aprov [data-p]').forEach(c=>prov[c.dataset.p]=c.checked&&!c.disabled);return{cat:$('#acat').value,kw:$('#akw').value.trim(),area:$('#aarea').value,max:Math.max(1,Math.min(500,+$('#amax').value||25)),prov}}
function showEst(){const o=readOpts(),e=estimate(o);S.agentProv=o.prov;S.agentMax=o.max;localStorage.setItem(K,JSON.stringify(S));
 $('#aest').innerHTML=`<b>Cost estimate before run: ${money(e.total)}</b> <span class="muted">(list price; Google's 1,000 free Enterprise requests a month and Hunter's 50 free credits usually make small runs $0)</span><table>${e.lines.map(l=>`<tr><td>${l[0]}</td><td class="muted">${l[1]}</td><td>${money(l[2])}</td></tr>`).join('')}</table>`}
const _rf=renderFinder;
renderFinder=function(){_rf();$('#v-finder').insertAdjacentHTML('afterbegin',agentForm()+'<div class="panel" id="ajobs"></div>');
 $$('#agent input,#agent select').forEach(el=>el.oninput=el.onchange=showEst);showEst();$('#arun').onclick=queueJob;renderJobs();
 health().then(()=>{if(!$('#agent'))return;const o=readOpts();$('#agent').outerHTML=agentForm();$('#acat').value=o.cat;$('#akw').value=o.kw;$('#aarea').value=o.area;$('#amax').value=o.max;$$('#agent input,#agent select').forEach(el=>el.oninput=el.onchange=showEst);showEst();$('#arun').onclick=queueJob})};
const S_jobs=()=>S.jobs||(S.jobs=[]);
function queueJob(){const o=readOpts();if(o.cat==='Custom keyword'&&!o.kw)return toast('Enter a keyword');if(!Object.values(o.prov).some(Boolean))return toast('Pick at least one provider');
 if(!o.prov.osm&&!o.prov.places)return toast('Pick a source: OpenStreetMap or Google Places');
 const est=estimate(o);const j={id:'job'+Date.now().toString(36),...o,status:'queued',progress:0,log:[],results:[],estimate:est.total,usage:null,created:new Date().toISOString()};
 S_jobs().unshift(j);S.jobs=S.jobs.slice(0,20);localStorage.setItem(K,JSON.stringify(S));renderJobs();runQueue()}
let RUNNING=false;
async function runQueue(){if(RUNNING)return;RUNNING=true;try{let j;while((j=S_jobs().find(x=>x.status==='queued'))){await runJob(j)}}finally{RUNNING=false}}
function jlog(j,m){j.log.push(new Date().toLocaleTimeString()+'  '+m);persistJob()}
let _pt;function persistJob(){clearTimeout(_pt);_pt=setTimeout(()=>{localStorage.setItem(K,JSON.stringify(S));renderJobs()},150)}
const esc_ovp=s=>s.replace(/[\\"]/g,'\\$&');
async function pool(items,n,fn){let i=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(i<items.length){const k=i++;await fn(items[k],k)}}))}
async function runJob(j){j.status='running';j.progress=1;jlog(j,`Started: ${j.cat}${j.kw?' "'+j.kw+'"':''} in ${j.area}, max ${j.max}`);
 const C=AG_CATS[j.cat],tag=C.tag,[s,w,n,e]=AREAS[j.area],bb=`(${s},${w},${n},${e})`;const res=[],seen=new Set(),add=r=>{const k=norm(r.company);if(!r.company||seen.has(k))return;seen.add(k);res.push(r)};
 try{
  if(j.prov.osm){jlog(j,'OpenStreetMap: querying…');const kw=esc_ovp(j.kw.toLowerCase());
   const qs=C.osm||[`nwr["name"~"${kw}",i]`,`nwr["shop"="${kw.replace(/ /g,'_')}"]`,`nwr["craft"="${kw.replace(/ /g,'_')}"]`,`nwr["office"="${kw.replace(/ /g,'_')}"]`,`nwr["amenity"="${kw.replace(/ /g,'_')}"]`];
   const q='[out:json][timeout:60];('+qs.map(x=>x+bb+';').join('')+');out tags center;';
   let d;try{d=SRV.ok?await api('/api/overpass',{query:q},j):await overpass(q)}catch(err){jlog(j,'Backend Overpass failed ('+err.message+'), trying direct from browser');d=await overpass(q);if($('#fstatus'))$('#fstatus').textContent=''}
   for(const el of d.elements||[]){const t=el.tags||{};add({company:t.name,phone:t.phone||t['contact:phone']||'',email:t.email||t['contact:email']||'',website:t.website||t['contact:website']||'',street:[t['addr:housenumber'],t['addr:street']].filter(Boolean).join(' '),city:t['addr:city']||'',postal:t['addr:postcode']||'',src:'osm',ref:'osm:'+el.type+'/'+el.id,tag})}
   jlog(j,`OpenStreetMap: ${res.length} named businesses`)}
  j.progress=25;persistJob();
  if(j.prov.places){jlog(j,'Google Places: text search…');const d=await api('/api/places/search',{query:`${C.q||j.kw} in ${AREA_TXT[j.area]}`,max:j.max,rect:[s,w,n,e]},j,'places');let before=res.length;
   for(const p of d.results){if(p.status&&p.status!=='OPERATIONAL')continue;const k=norm(p.company);const ex=res.find(r=>norm(r.company)===k);
    if(ex){ex.phone=ex.phone||p.phone;ex.website=ex.website||p.website;ex.maps=p.maps;ex.src+='+google';continue}
    const parts=(p.address||'').split(',');add({company:p.company,phone:p.phone,email:'',website:p.website,street:parts[0]||'',city:(parts[1]||'').trim(),postal:((parts[2]||'').match(/[A-Z]\d[A-Z] ?\d[A-Z]\d/)||[''])[0],src:'google',ref:'gplace:'+p.place_id,maps:p.maps,tag,types:p.types})}
   jlog(j,`Google Places: ${d.results.length} results in ${d.requests} request(s), ${res.length-before} new after merge`)}
  // keep best candidates first (has website/phone), then cap
  res.sort((a,b)=>(!!b.website+!!b.phone)-(!!a.website+!!a.phone));res.splice(j.max);res.forEach(r=>r.dup=isDup(r));
  j.results=res;j.progress=40;jlog(j,`${res.length} leads kept (max ${j.max}), ${res.filter(r=>r.dup).length} already in pipeline`);
  const todo=res.filter(r=>!r.dup);
  if(j.prov.web){const ws=todo.filter(r=>r.website);jlog(j,`Website enrichment: ${ws.length} sites (robots.txt respected)…`);let k=0;
   await pool(ws,4,async r=>{try{const x=await api('/api/enrich',{url:r.website},j);if(x.error)r.webnote=x.error;else{r.email=r.email||x.emails[0]||'';r.emails=x.emails;r.phone=r.phone||x.phones[0]||'';r.contact_url=x.contact_url;r.title=x.title;r.description=x.description}}catch(err){r.webnote=err.message}
    k++;j.progress=40+Math.round(30*k/ws.length);persistJob()});
   jlog(j,`Website enrichment: ${ws.filter(r=>r.emails?.length).length} emails, ${ws.filter(r=>r.contact_url).length} contact pages, ${ws.filter(r=>r.webnote).length} skipped/blocked`)}
  j.progress=70;persistJob();
  if(j.prov.hunter){const hs=todo.filter(r=>r.website&&!r.email);jlog(j,`Hunter: ${hs.length} domains…`);
   await pool(hs,2,async r=>{try{const x=await api('/api/email/hunter',{domain:r.website},j,'hunter');const best=x.emails.sort((a,b)=>(b.confidence||0)-(a.confidence||0))[0];if(best){r.email=best.value;r.emailsrc='hunter '+(best.confidence||'')+'%'}}catch(err){r.hnote=err.message}});
   jlog(j,`Hunter: ${hs.filter(r=>r.emailsrc).length} emails found`)}
  j.progress=80;persistJob();
  if(j.prov.llm){jlog(j,`AI scoring with ${CFG.llm}: ${todo.length} leads…`);let k=0;
   await pool(todo,3,async r=>{try{const x=await api('/api/llm',{provider:CFG.llm,offer:CFG.offer,lead:{company:r.company,category:tag,address:r.street,city:r.city,website:r.website,title:r.title,description:r.description,types:r.types}},j,CFG.llm);r.score=x.score;r.fit=x.fit;r.summary=x.summary;r.opener=x.opener}catch(err){r.lnote=err.message}k++;j.progress=80+Math.round(18*k/todo.length);persistJob()});
   res.sort((a,b)=>(b.score??-1)-(a.score??-1));jlog(j,'AI scoring: done')}
  if(SRV.ok){try{j.usage=await (await fetch(CFG.server+'/api/usage?run='+j.id)).json()}catch(e){}}
  j.status='done';j.progress=100;jlog(j,`Finished. Estimated ${money(j.estimate)}, actual ${j.usage?money(j.usage.total_cost):'$0 (no backend)'}`)}
 catch(err){j.status='failed';jlog(j,'FAILED: '+err.message);if(SRV.ok){try{j.usage=await (await fetch(CFG.server+'/api/usage?run='+j.id)).json()}catch(e){}}}
 persistJob()}
let OPENJOB=null;
function renderJobs(){const el=$('#ajobs');if(!el)return;const J=S_jobs();
 el.innerHTML=`<h2>Job queue</h2>`+(J.length?J.map(j=>`<div class="tpl" data-job="${j.id}"><div class="dueitem"><span class="tag ${j.status==='done'?'':j.status==='failed'?'over':'today'}">${j.status}</span><b>${esc(j.cat)}${j.kw?' "'+esc(j.kw)+'"':''} · ${esc(j.area)} · max ${j.max}</b><span class="muted">${Object.keys(j.prov).filter(k=>j.prov[k]).join(' + ')}</span><span>est ${money(j.estimate)} · actual ${j.usage?money(j.usage.total_cost):'—'}</span><button data-open="${j.id}">${OPENJOB===j.id?'Hide':'Results ('+j.results.length+')'}</button><button data-rm="${j.id}" class="danger">✕</button></div>
  <div style="background:#e6ebf1;border-radius:4px;height:6px;margin:4px 0"><div class="bar" style="background:#1f7ae0;height:6px;border-radius:4px;width:${j.progress}%"></div></div>
  ${OPENJOB===j.id?jobDetail(j):''}</div>`).join(''):'<div class="muted">No jobs yet.</div>');
 $$('[data-open]').forEach(b=>b.onclick=()=>{OPENJOB=OPENJOB===b.dataset.open?null:b.dataset.open;renderJobs()});
 $$('[data-rm]').forEach(b=>b.onclick=()=>{S.jobs=S.jobs.filter(x=>x.id!==b.dataset.rm||x.status==='running');localStorage.setItem(K,JSON.stringify(S));renderJobs()});
 const j=J.find(x=>x.id===OPENJOB);if(j&&$('#jimp')){$('#jall').onclick=()=>$$('#jres [data-i]:not(:disabled)').forEach(c=>c.checked=true);$('#jimp').onclick=()=>importJob(j)}}
function jobDetail(j){const u=j.usage;return `<details ${j.status!=='done'?'open':''}><summary class="muted">Log (${j.log.length})</summary><pre>${esc(j.log.join('\n'))}</pre></details>
 ${u&&u.items.length?`<table><tr><th>Provider</th><th>SKU</th><th>Units</th><th>Cache hits</th><th>Cost</th></tr>${u.items.map(i=>`<tr><td>${esc(i.provider)}</td><td>${esc(i.sku)}</td><td>${i.units}</td><td>${i.cache_hits}</td><td>${money(i.cost)}</td></tr>`).join('')}</table>`:''}
 ${j.results.length?`<div class="acts" style="justify-content:flex-start"><button id="jall">Select all new</button><button id="jimp" class="pri">Import selected as New leads</button><label><input type="checkbox" id="jseq" style="width:auto"> + start sequence</label></div>
 <div style="overflow-x:auto"><table id="jres"><tr><th></th><th>Business</th><th>Phone</th><th>Email</th><th>Web</th>${j.prov.llm?'<th>Score</th><th>Summary / opener</th>':''}<th>Source</th></tr>${j.results.map((r,i)=>`<tr class="${r.dup?'dup':''}"><td><input type="checkbox" data-i="${i}" ${r.dup?'disabled':''} style="width:auto"></td><td>${esc(r.company)}${r.dup?' <span class="tag">in pipeline</span>':''}<div class="muted">${esc(r.street)} ${esc(r.city)}</div></td><td>${esc(r.phone)}</td><td>${esc(r.email)}${r.emailsrc?`<div class="muted">${esc(r.emailsrc)}</div>`:''}</td><td>${r.website?`<a href="${esc(r.website)}" target="_blank" rel="noopener">site</a>`:''}${r.contact_url?` · <a href="${esc(r.contact_url)}" target="_blank" rel="noopener">contact</a>`:''}${r.webnote?`<div class="muted">${esc(r.webnote)}</div>`:''}</td>${j.prov.llm?`<td>${r.score??''}</td><td>${esc(r.summary||r.lnote||'')}<div class="muted">${esc(r.opener||'')}</div></td>`:''}<td class="muted">${esc(r.src)}</td></tr>`).join('')}</table></div>`:''}`}
function importJob(j){let n=0;$$('#jres [data-i]:checked').forEach(c=>{const r=j.results[+c.dataset.i];if(isDup(r))return;
 const l={id:uid(),first:'',last:'',company:r.company,phone:r.phone||'',email:r.email||'',website:r.website||'',street:r.street||'',city:r.city||'',prov:'BC',postal:r.postal||'',country:'Canada',source:'Lead Finder',tags:['agent',r.tag,r.fit?'fit-'+r.fit:''].filter(Boolean).join(','),stage:S.stages[0],callback:'',value:'',
  opener:r.opener||'',score:r.score??'',notes:[r.summary?`AI (${r.score}): ${r.summary}`:'',r.opener?`Opener: ${r.opener}`:'',r.contact_url?`Contact page: ${r.contact_url}`:'',`Source: ${r.src} ${r.ref||''}`].filter(Boolean).join('\n'),calls:[],tasks:[],created:today()};
 if($('#jseq').checked)startSeq(l);S.leads.push(l);r.dup=true;n++});save();renderJobs();toast(n+' leads imported')}
// ---- Settings tab
function renderSettings(){const el=$('#v-settings');if(!el||el.dataset.r)return;el.dataset.r=1;
 el.innerHTML=`<div class="panel"><h2>Settings: Scraper Agent</h2><p class="muted">API keys are saved only in this browser's localStorage and sent only to your own backend (in the X-Api-Key header), which forwards them to the provider. For a shared or hosted setup, put the keys in the server's environment variables instead and leave these blank. Keys are never put in leads or CSV exports.</p>
 <div class="grid"><div class="full"><label>Backend URL</label><input id="s-server" value="${esc(CFG.server)}"></div>
 <div><label>Google Places API key</label><input type="password" id="s-places" value="${esc(CFG.keys.places||'')}" autocomplete="off"></div>
 <div><label>Hunter.io API key</label><input type="password" id="s-hunter" value="${esc(CFG.keys.hunter||'')}" autocomplete="off"></div>
 <div><label>AI provider</label><select id="s-llm">${Object.entries(PRICES.llm).map(([k,v])=>`<option value="${k}" ${k===CFG.llm?'selected':''}>${k} (${v[2]})</option>`).join('')}</select></div>
 <div><label>AI API key (for selected provider)</label><input type="password" id="s-llmkey" value="${esc(CFG.keys[CFG.llm]||'')}" autocomplete="off"></div>
 <div class="full"><label>What you sell (used by the AI scoring)</label><input id="s-offer" value="${esc(CFG.offer)}"></div></div>
 <div class="acts"><button id="s-test">Test backend</button><button id="s-clear" class="danger">Clear keys</button><button id="s-save" class="pri">Save settings</button></div><div id="s-status" class="muted"></div></div>`;
 $('#s-llm').onchange=()=>{$('#s-llmkey').value=CFG.keys[$('#s-llm').value]||''};
 $('#s-save').onclick=()=>{CFG.server=$('#s-server').value.replace(/\/$/,'');CFG.keys.places=$('#s-places').value.trim();CFG.keys.hunter=$('#s-hunter').value.trim();CFG.llm=$('#s-llm').value;CFG.keys[CFG.llm]=$('#s-llmkey').value.trim();CFG.offer=$('#s-offer').value;saveCfg();$('#v-finder').innerHTML='';toast('Settings saved');render()};
 $('#s-clear').onclick=()=>{CFG.keys={};saveCfg();el.dataset.r='';renderSettings();toast('Keys cleared')};
 $('#s-test').onclick=async()=>{CFG.server=$('#s-server').value.replace(/\/$/,'');const h=await health();$('#s-status').textContent=h.ok?'Backend OK. Server-side keys: '+Object.entries(h.keys).filter(x=>x[1]).map(x=>x[0]).join(', ')||'none':'Backend not reachable at '+CFG.server}}
// AI opener template
const _load=load;load=function(){const d=_load();if(!d.tpl.some(t=>t.id==='t4'))d.tpl.push({id:'t4',kind:'call',title:'AI opening line',body:'{opener}'});d.jobs=(d.jobs||[]).map(j=>j.status==='running'||j.status==='queued'?{...j,status:'failed',log:[...j.log,'Interrupted (page closed)']}:j);return d};

