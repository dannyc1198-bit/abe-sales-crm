// ===== v5 Search & Select agent: free-text search, manual pick, free allowance meter, beta tools =====
// Loaded after scraper.js; replaces the v3 preset job flow. Reuses api(), health(), hasKey(), pool(), overpass(), PRICES, CFG.
CFG.quota=CFG.quota??200;CFG.plan=CFG.plan||'beta';CFG.paywall=CFG.paywall??false;
const FREE_TIER={places:1000,hunter:50};
const PRESETS={'Restaurants':['nwr["amenity"~"^(restaurant|cafe|fast_food|pub|bar)$"]'],
 'Strata / property managers':['nwr["office"="property_management"]','nwr["name"~"strata|property management",i]'],
 'Retirement homes':['nwr["amenity"="nursing_home"]','nwr["social_facility"~"^(assisted_living|nursing_home)$"]','nwr["healthcare"="nursing_home"]'],
 'Plumbers':['nwr["craft"="plumber"]'],'HVAC':['nwr["craft"="hvac"]','nwr["name"~"heating|hvac|mechanical",i]'],'Hotels':['nwr["tourism"~"^(hotel|motel)$"]'],
 'Schools':['nwr["amenity"="school"]'],'Churches':['nwr["amenity"="place_of_worship"]'],'Dental clinics':['nwr["amenity"="dentist"]','nwr["healthcare"="dentist"]']};
// ---- beta stats + monthly quota (localStorage; mirrored to server log when backend runs)
const BK='salescrm_beta',QK='salescrm_quota',month=()=>new Date().toISOString().slice(0,7);
const BETA=Object.assign({started:new Date().toISOString(),searches:0,found:0,selected:0,enriched:0,imported:0,moves:0,paidCalls:0,paidCost:0,errors:[],feedback:[]},JSON.parse(localStorage.getItem(BK)||'{}'));
const saveBeta=()=>localStorage.setItem(BK,JSON.stringify(BETA));
let Q=JSON.parse(localStorage.getItem(QK)||'null');if(!Q||Q.month!==month())Q={month:month(),used:0,beyond:0,places:0,hunter:0,llm:0,cost:0};
const saveQ=()=>localStorage.setItem(QK,JSON.stringify(Q));
function berr(m){BETA.errors.push({at:new Date().toISOString(),msg:String(m).slice(0,200)});BETA.errors=BETA.errors.slice(-50);saveBeta()}
function srvLog(kind,units,cost=0){if(SRV.ok)fetch(CFG.server+'/api/quota',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,units,cost,month:Q.month})}).catch(()=>{})}
function countLookups(rows){const n=rows.filter(r=>!r.counted).length;if(!n)return;rows.forEach(r=>r.counted=true);const free=Math.max(0,Math.min(n,CFG.quota-Q.used));Q.used+=free;Q.beyond+=n-free;saveQ();srvLog('lookup',n);meter()}
function paidUse(p,units,cost){Q[p]=(Q[p]||0)+units;Q.cost+=cost;BETA.paidCalls+=units;BETA.paidCost+=cost;saveQ();saveBeta();srvLog(p,units,cost);meter()}
function meterHTML(){const rem=Math.max(0,CFG.quota-Q.used),pct=Math.min(100,100*Q.used/Math.max(1,CFG.quota));
 return `<b>Free allowance ${Q.month}:</b> ${Q.used} / ${CFG.quota} lead lookups used · <b>${rem} free left</b> · ${Q.beyond} beyond free
 <div class="mbar"><div style="width:${pct}%;background:${rem?'var(--acc)':'var(--bad)'}"></div></div>
 <span class="muted">Provider free tiers this month: Google Places ${Q.places}/${FREE_TIER.places} searches · Hunter ${Q.hunter}/${FREE_TIER.hunter} emails · AI calls ${Q.llm} · paid spend est ${money(Q.cost)}. A lookup = one company you enrich or import. Searching and browsing results is free.</span>`}
function meter(){$$('.qmeter').forEach(m=>m.innerHTML=meterHTML())}
// paid gate: confirm needed when free allowance is gone or a provider's free tier is exhausted
function gate(n,paid){const over=Q.used+n-CFG.quota,tierOut=paid.filter(p=>FREE_TIER[p]!=null&&Q[p]>=FREE_TIER[p]);
 if(paid.length&&(over>0||tierOut.length))return confirm(`Free allowance ${over>0?'used up ('+Q.used+'/'+CFG.quota+')':'OK'}${tierOut.length?'; free tier finished for '+tierOut.join(', '):''}.\nThis will make PAID calls (${paid.join(', ')}). Continue?`);
 if(over>0)return confirm(`${over} of these ${n} lookups are beyond the free monthly allowance (${CFG.quota}). Continue?`);return true}
// ---- geocode any city/address (free Nominatim, via backend when available)
async function geocode(t){const m=t.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);if(m)return{lat:+m[1],lon:+m[2],label:t};
 const d=SRV.ok?await api('/api/geocode',{q:t},{id:'geo'}):await (await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ca,us&q='+encodeURIComponent(t))).json();
 if(!d.length)throw new Error('Location not found: '+t);return{lat:+d[0].lat,lon:+d[0].lon,label:d[0].display_name}}
function bbox(c,km){const dl=km/111,dn=km/(111*Math.cos(c.lat*Math.PI/180));return[c.lat-dl,c.lon-dn,c.lat+dl,c.lon+dn].map(x=>+x.toFixed(4))}
function kwSelectors(kw){if(PRESETS[kw])return PRESETS[kw];const k=esc_ovp(kw.toLowerCase().trim()),u=k.replace(/ /g,'_'),sg=u.replace(/s$/,'');
 return[`nwr["name"~"${k}",i]`,...['shop','craft','office','amenity','healthcare','tourism','leisure'].map(t=>`nwr["${t}"~"^(${u}|${sg})$",i]`)]}
let SR=null;
function renderFinder(){const sr=S.lastSearch||{};$('#v-finder').innerHTML=`<div class="panel" id="agent"><div class="steps"><span class="on"><b>1</b>Search</span><span class="${SR?.results?.length?'on':''}"><b>2</b>Pick</span><span><b>3</b>Enrich &amp; import</span></div><h2 class="stephd"><span class="num">1</span>Search businesses</h2>
 <p class="muted">Type any kind of business and any place. You pick which companies to keep. Business listings only, no private individuals or homeowner lists. CASL: call freely; email/text only with implied consent (published business address, relevant to their role) and always an opt-out.</p>
 <div class="qmeter"></div>
 <div class="grid"><div><label>What (any keyword)</label><input id="skw" placeholder="e.g. property management, plumbers, daycare" value="${esc(sr.kw||'')}"></div>
 <div><label>Where (city or address)</label><input id="sloc" placeholder="e.g. Surrey, BC or 20000 Fraser Hwy, Langley" value="${esc(sr.loc||'')}"></div>
 <div><label>Radius</label><select id="srad">${[2,5,10,15,25,50].map(r=>`<option value="${r}" ${r==(sr.rad||10)?'selected':''}>${r} km</option>`).join('')}</select></div>
 <div><label>Max results</label><input id="smax" type="number" min="1" max="500" value="${sr.max||50}"></div></div>
 <div class="chips"><span class="muted">Quick picks (optional):</span> ${Object.keys(PRESETS).map(p=>`<button class="chip" data-chip="${esc(p)}">${esc(p)}</button>`).join('')}</div>
 <div class="srcrow"><label><input type="checkbox" id="s-osm" checked style="width:auto"> OpenStreetMap <span class="tag">free</span></label>
 <label><input type="checkbox" id="s-gp" style="width:auto" ${hasKey({key:'places'})&&SRV.ok?'':'disabled'}> Google Places <span class="tag today">paid · 1,000/mo free</span></label>
 <span style="flex:1"></span><button id="sgo" class="pri">Search <kbd>↵</kbd></button></div><div id="fstatus" class="muted" style="margin-top:8px"></div></div>
 <div class="panel" id="sres"></div>`;
 meter();$$('[data-chip]').forEach(b=>b.onclick=()=>{$('#skw').value=b.dataset.chip});$('#sgo').onclick=doSearch;['#skw','#sloc'].forEach(i=>$(i).onkeydown=e=>{if(e.key==='Enter')doSearch()});
 if(S.lastSearch?.results){SR=S.lastSearch;showSR()}
 health().then(()=>{const g=$('#s-gp');if(g)g.disabled=!(hasKey({key:'places'})&&SRV.ok)})}
async function doSearch(){const kw=$('#skw').value.trim(),loc=$('#sloc').value.trim(),rad=+$('#srad').value,max=Math.max(1,Math.min(500,+$('#smax').value||50));
 if(!kw)return toast('Type what kind of business');if(!loc)return toast('Type a city or address');
 const useGp=$('#s-gp').checked&&!$('#s-gp').disabled,useOsm=$('#s-osm').checked;if(!useOsm&&!useGp)return toast('Pick a source');
 if(useGp&&!gate(0,['places']))return;
 const st=$('#fstatus'),job={id:'s'+Date.now().toString(36)};BETA.searches++;saveBeta();
 try{st.textContent='Finding location…';const c=await geocode(loc),[s,w,n,e]=bbox(c,rad);const res=[],seen=new Set();
  const add=r=>{const k=norm(r.company)+norm(String(r.street||'').replace(/\d/g,''));if(!r.company||seen.has(k))return;seen.add(k);res.push(r)};
  if(useOsm){st.textContent='Searching OpenStreetMap…';const q='[out:json][timeout:60];('+kwSelectors(kw).map(x=>x+`(${s},${w},${n},${e});`).join('')+');out tags center;';
   let d;try{d=SRV.ok?await api('/api/overpass',{query:q},job):await overpass(q)}catch(err){d=await overpass(q)}
   for(const el of d.elements||[]){const t=el.tags||{};add({company:t.name,phone:t.phone||t['contact:phone']||'',email:t.email||t['contact:email']||'',website:t.website||t['contact:website']||'',street:[t['addr:housenumber'],t['addr:street']].filter(Boolean).join(' '),city:t['addr:city']||'',postal:t['addr:postcode']||'',src:'osm',ref:'osm:'+el.type+'/'+el.id,kind:t.office||t.shop||t.craft||t.amenity||t.healthcare||t.tourism||'',hours:t.opening_hours||''})}}
  if(useGp){st.textContent='Searching Google Places…';const d=await api('/api/places/search',{query:`${kw} near ${loc}`,max,rect:[s,w,n,e]},job,'places');paidUse('places',d.requests||1,(d.requests||1)*PRICES.places_text);
   for(const p of d.results){if(p.status&&p.status!=='OPERATIONAL')continue;const ex=res.find(r=>norm(r.company)===norm(p.company));if(ex){ex.phone=ex.phone||p.phone;ex.website=ex.website||p.website;ex.src+='+google';continue}
    const pa=(p.address||'').split(',');add({company:p.company,phone:p.phone,email:'',website:p.website,street:pa[0]||'',city:(pa[1]||'').trim(),postal:((pa[2]||'').match(/[A-Z]\d[A-Z] ?\d[A-Z]\d/)||[''])[0],src:'google',ref:'gplace:'+p.place_id,kind:(p.types||[])[0]||''})}}
  res.sort((a,b)=>(!!b.website+!!b.phone)-(!!a.website+!!a.phone));res.splice(max);res.forEach(r=>r.dup=isDup(r));
  BETA.found+=res.length;saveBeta();SR={kw,loc,rad,max,where:c.label,results:res};S.lastSearch=SR;localStorage.setItem(K,JSON.stringify(S));
  st.textContent=`${res.length} found near ${c.label.split(',').slice(0,2).join(',')} · ${res.filter(r=>r.phone).length} with phone · ${res.filter(r=>r.website).length} with website · ${res.filter(r=>r.dup).length} already in pipeline`;showSR()}
 catch(err){st.textContent=err.message;berr('search: '+err.message)}}
function showSR(){const R=SR.results,el=$('#sres');if(!R.length){el.innerHTML='<div class="muted">No results. Try another keyword, a bigger radius, or a quick pick.</div>';return}
 const pv=PROVIDERS.filter(p=>p.step!=='source');
 el.innerHTML=`<h2 class="stephd"><span class="num">2</span>Pick companies <span class="tag">${R.length} results</span><span style="margin-left:auto;display:flex;gap:6px"><button id="sall">Select all</button><button id="snone">Select none</button></span></h2>
 <div class="tablewrap"><table id="jres"><tr><th></th><th>Business</th><th>Phone</th><th>Website / email</th><th>Address</th><th>Source</th></tr>${R.map((r,i)=>`<tr class="${r.dup?'dup':''}"><td><input type="checkbox" data-i="${i}" ${r.dup?'disabled':''} ${r.sel&&!r.dup?'checked':''} style="width:auto"></td>
 <td><b>${esc(r.company)}</b>${r.dup?' <span class="tag">in pipeline</span>':''}<div class="muted">${esc(r.kind)} ${r.score!=null?'· AI '+r.score+': '+esc(r.summary||''):''}</div></td><td>${esc(r.phone)}</td>
 <td>${r.website?`<a href="${esc(r.website)}" target="_blank" rel="noopener">site</a>`:''} ${esc(r.email||'')}${r.contact_url?` · <a href="${esc(r.contact_url)}" target="_blank" rel="noopener">contact</a>`:''}${r.webnote?`<div class="muted">${esc(r.webnote)}</div>`:''}</td>
 <td>${esc(r.street)} ${esc(r.city)} ${esc(r.postal)}</td><td class="muted">${esc(r.src)}${r.enriched?' ✓enriched':''}</td></tr>`).join('')}</table></div>
 <h2 class="stephd" style="margin-top:24px"><span class="num">3</span>Enrich &amp; import <span class="muted" style="font-weight:400">runs only on the selected rows</span></h2><div id="aprov">${pv.map(p=>{const av=hasKey(p)&&SRV.ok;return `<label style="display:block"><input type="checkbox" data-p="${p.id}" style="width:auto" ${p.id==='web'&&av?'checked':''} ${av?'':'disabled'}> ${p.name} <span class="tag ${p.paid?'today':''}">${p.paid?'paid':'free'}</span> ${av?'':`<span class="tag over">${p.paid&&!hasKey(p)?'needs API key (Settings)':'needs backend'}</span>`}</label>`}).join('')}</div>
 <div class="abar"><span id="scount"></span><span class="muted">${Math.max(0,CFG.quota-Q.used)} free lookups left</span><span class="sp"></span><label><input type="checkbox" id="jseq"> + start sequence</label><button id="senr">Enrich selected</button><button id="simp" class="pri">Import selected as New leads</button></div>`;
 const cnt=()=>{const n=sel().length;$('#scount').textContent=n+' selected';R.forEach((r,i)=>r.sel=!!$(`#jres [data-i="${i}"]`)?.checked)};
 $$('#jres [data-i]').forEach(c=>c.onchange=cnt);$('#sall').onclick=()=>{$$('#jres [data-i]:not(:disabled)').forEach(c=>c.checked=true);cnt()};$('#snone').onclick=()=>{$$('#jres [data-i]').forEach(c=>c.checked=false);cnt()};
 $('#senr').onclick=enrichSel;$('#simp').onclick=importSel;cnt()}
const sel=()=>$$('#jres [data-i]:checked').map(c=>SR.results[+c.dataset.i]);
async function enrichSel(){const rows=sel();if(!rows.length)return toast('Select some companies first');
 const pr={};$$('#aprov [data-p]').forEach(c=>pr[c.dataset.p]=c.checked&&!c.disabled);const paid=['hunter','llm'].filter(p=>pr[p]);
 if(!pr.web&&!paid.length)return toast('Pick an enrichment provider');const fresh=rows.filter(r=>!r.counted).length;
 if(!gate(fresh,paid))return toast('Cancelled, nothing was charged');BETA.selected+=rows.length;const st=$('#scount'),job={id:'e'+Date.now().toString(36)};
 try{if(pr.web){const ws=rows.filter(r=>r.website);let k=0;await pool(ws,4,async r=>{st.textContent=`Website scan ${++k}/${ws.length}…`;try{const x=await api('/api/enrich',{url:r.website},job);if(x.error)r.webnote=x.error;else{r.email=r.email||x.emails[0]||'';r.phone=r.phone||x.phones[0]||'';r.contact_url=x.contact_url;r.title=x.title;r.description=x.description}}catch(e){r.webnote=e.message}})}
  if(pr.hunter){const hs=rows.filter(r=>r.website&&!r.email);await pool(hs,2,async r=>{try{const x=await api('/api/email/hunter',{domain:r.website},job,'hunter');const b=x.emails.sort((a,c)=>(c.confidence||0)-(a.confidence||0))[0];if(b){r.email=b.value;r.emailsrc='hunter';paidUse('hunter',1,PRICES.hunter_credit)}}catch(e){r.webnote=e.message;berr('hunter: '+e.message)}})}
  if(pr.llm){const L=PRICES.llm[CFG.llm];await pool(rows,3,async r=>{try{const x=await api('/api/llm',{provider:CFG.llm,offer:CFG.offer,lead:{company:r.company,category:SR.kw,address:r.street,city:r.city,website:r.website,title:r.title,description:r.description}},job,CFG.llm);Object.assign(r,{score:x.score,fit:x.fit,summary:x.summary,opener:x.opener});paidUse('llm',1,(700*L[0]+150*L[1])/1e6)}catch(e){berr('llm: '+e.message)}})}
  rows.forEach(r=>r.enriched=true);countLookups(rows);BETA.enriched+=rows.length;saveBeta();localStorage.setItem(K,JSON.stringify(S));showSR();toast(rows.length+' companies enriched')}
 catch(e){berr('enrich: '+e.message);toast(e.message)}}
function importSel(){const rows=sel().filter(r=>!isDup(r));if(!rows.length)return toast('Select some companies first');if(!gate(rows.filter(r=>!r.counted).length,[]))return;
 countLookups(rows);rows.forEach(r=>{const l={id:uid(),first:'',last:'',company:r.company,phone:r.phone||'',email:r.email||'',website:r.website||'',street:r.street||'',city:r.city||'',prov:'BC',postal:r.postal||'',country:'Canada',source:'Lead Finder',tags:['finder',norm(SR.kw).slice(0,20),r.fit?'fit-'+r.fit:''].filter(Boolean).join(','),stage:S.stages[0],callback:'',value:'',opener:r.opener||'',score:r.score??'',
  notes:[r.summary?`AI (${r.score}): ${r.summary}`:'',r.opener?`Opener: ${r.opener}`:'',r.contact_url?`Contact page: ${r.contact_url}`:'',`Source: ${r.src} ${r.ref||''}`].filter(Boolean).join('\n'),calls:[],tasks:[],created:today()};
  if($('#jseq').checked)startSeq(l);S.leads.push(l);r.dup=true;r.sel=false});
 BETA.imported+=rows.length;saveBeta();localStorage.setItem(K,JSON.stringify(S));render();showSR();toast(rows.length+' leads imported')}
// ---- count pipeline moves for the beta report
const _setStage=setStage;setStage=function(id,st){const l=lead(id),b=l&&l.stage;_setStage(id,st);if(l&&l.stage!==b){BETA.moves++;saveBeta()}};
window.addEventListener('error',e=>berr('js: '+e.message));
// ---- Settings: plan, quota, feedback, beta report
const FEATURES=['Find businesses','Review & pick','Enrichment','Pipeline board','Today / reminders','Templates','Jobber push','Other'];
const _rs=renderSettings;renderSettings=function(){const el=$('#v-settings'),first=!el.dataset.r;_rs();if(!first)return;
 el.insertAdjacentHTML('beforeend',`<div class="panel" id="beta"><h2>Plan &amp; free allowance</h2><div class="grid">
 <div><label>Plan</label><select id="b-plan"><option value="beta">Beta tester (free)</option><option value="free">Free</option><option value="pro">Pro (later)</option></select></div>
 <div><label>Free lead lookups per month (admin)</label><input id="b-quota" type="number" min="0" value="${CFG.quota}"></div>
 <div><label><input type="checkbox" id="b-pay" style="width:auto" ${CFG.paywall?'checked':''}> Paywall on (placeholder, does nothing yet)</label></div></div>
 <div class="qmeter"></div><div class="acts"><button id="b-reset" class="danger">Reset this month's counter</button><button id="b-save" class="pri">Save plan</button></div></div>
 <div class="panel"><h2>💬 Send feedback (beta)</h2><p class="muted">Saved only on this device. Nothing is sent anywhere. Use "Export beta report" and share the file yourself.</p>
 <div class="grid"><div><label>Feature</label><select id="fb-f">${FEATURES.map(f=>`<option>${f}</option>`).join('')}</select></div><div><label>Rating</label><select id="fb-r">${[5,4,3,2,1].map(n=>`<option value="${n}">${'★'.repeat(n)} ${n}</option>`).join('')}</select></div>
 <div class="full"><label>Notes</label><textarea id="fb-n" rows="3" placeholder="What worked, what didn't, what you want"></textarea></div></div>
 <div class="acts"><button id="fb-save" class="pri">Save feedback</button></div><div id="fb-list"></div>
 <h3>Beta report</h3><div class="acts" style="justify-content:flex-start"><button id="br-json">Export beta report (JSON)</button><button id="br-csv">Export beta report (CSV)</button></div></div>`);
 $('#b-plan').value=CFG.plan;meter();fbList();
 $('#b-save').onclick=()=>{CFG.plan=$('#b-plan').value;CFG.quota=Math.max(0,+$('#b-quota').value||0);CFG.paywall=$('#b-pay').checked;saveCfg();meter();toast('Plan saved')};
 $('#b-reset').onclick=()=>{if(confirm('Reset this month\'s usage counter?')){Q={month:month(),used:0,beyond:0,places:0,hunter:0,llm:0,cost:0};saveQ();meter()}};
 $('#fb-save').onclick=()=>{const n=$('#fb-n').value.trim();if(!n)return toast('Write a note first');BETA.feedback.push({at:new Date().toISOString(),feature:$('#fb-f').value,rating:+$('#fb-r').value,notes:n});saveBeta();$('#fb-n').value='';fbList();toast('Feedback saved')};
 $('#br-json').onclick=()=>dl(`beta-report-${today()}.json`,JSON.stringify(report(),null,2),'application/json');
 $('#br-csv').onclick=()=>{const r=report(),rows=[['section','key','value']];Object.entries(r.usage).forEach(([k,v])=>rows.push(['usage',k,v]));Object.entries(r.quota).forEach(([k,v])=>rows.push(['quota',k,v]));Object.entries(r.pipeline).forEach(([k,v])=>rows.push(['pipeline',k,typeof v==='object'?JSON.stringify(v):v]));
  r.errors.forEach(e=>rows.push(['error',e.at,e.msg]));r.feedback.forEach(f=>rows.push(['feedback',f.feature+' ('+f.rating+'/5)',f.notes]));dl(`beta-report-${today()}.csv`,toCSV(rows[0],rows.slice(1)))}};
function fbList(){const e=$('#fb-list');if(e)e.innerHTML=BETA.feedback.slice().reverse().map(f=>`<div class="muted">${f.at.slice(0,10)} · <b>${esc(f.feature)}</b> ${'★'.repeat(f.rating)} · ${esc(f.notes)}</div>`).join('')}
function report(){const st={};S.leads.forEach(l=>st[l.stage]=(st[l.stage]||0)+1);
 return{app:'Pipeline Sales CRM v5',plan:CFG.plan,paywall:CFG.paywall,exported:new Date().toISOString(),beta_started:BETA.started,
  usage:{searches:BETA.searches,leads_found:BETA.found,leads_selected_for_enrichment:BETA.selected,leads_enriched:BETA.enriched,leads_imported:BETA.imported,pipeline_moves:BETA.moves,paid_calls:BETA.paidCalls,paid_cost_usd_est:+BETA.paidCost.toFixed(4)},
  quota:{month:Q.month,free_allowance:CFG.quota,used:Q.used,beyond_free:Q.beyond,google_places_requests:Q.places,hunter_credits:Q.hunter,ai_calls:Q.llm,spend_usd_est:+Q.cost.toFixed(4)},
  pipeline:{leads_total:S.leads.filter(l=>!l.example).length,by_stage:st,reminders_done:(S.done||[]).length,tasks_done:S.leads.reduce((a,l)=>a+(l.tasks||[]).filter(k=>k.done===true).length,0),calls_logged:S.leads.reduce((a,l)=>a+(l.calls||[]).length,0)},
  errors:BETA.errors,feedback:BETA.feedback}}
init();
