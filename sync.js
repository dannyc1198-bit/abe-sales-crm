// Opt-in usage sync to Supabase. OFF unless Settings > "Share usage with Danny" is ticked AND url/key set.
// Config (localStorage salescrm_sync or window.SYNC_CFG): {on:false,url:'SUPABASE_URL',key:'SUPABASE_ANON_KEY',label:'Abraham'}
(function(){const SK='salescrm_sync';const C=Object.assign({on:false,url:'',key:'',label:'Abraham'},window.SYNC_CFG||{},JSON.parse(localStorage.getItem(SK)||'{}'));
 C.dev=C.dev||('d'+Math.random().toString(36).slice(2,10));localStorage.setItem(SK,JSON.stringify(C));
 const QK='salescrm_syncq';let q=JSON.parse(localStorage.getItem(QK)||'[]');
 const ready=()=>C.on&&/^https:\/\//.test(C.url)&&C.key;
 const h=()=>({apikey:C.key,Authorization:'Bearer '+C.key,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'});
 window.track=(kind,o={})=>{if(!C.on)return;q.push(Object.assign({device_id:C.dev,at:new Date().toISOString(),kind},o));q=q.slice(-2000);localStorage.setItem(QK,JSON.stringify(q))};
 async function flush(){if(!ready()||!navigator.onLine)return;try{
  await fetch(C.url+'/rest/v1/devices',{method:'POST',headers:h(),body:JSON.stringify({id:C.dev,label:C.label,last_seen:new Date().toISOString()})});
  if(q.length){const b=q.slice(0,500);const r=await fetch(C.url+'/rest/v1/events',{method:'POST',headers:h(),body:JSON.stringify(b)});if(r.ok){q=q.slice(b.length);localStorage.setItem(QK,JSON.stringify(q))}}
  const L=((typeof S!=='undefined'?S:{}).leads||[]).filter(l=>!l.example).map(l=>({device_id:C.dev,id:l.id,company:l.company||'',stage:l.stage,value:+l.value||null,source:l.source,city:l.city,created:l.created||null,updated_at:new Date().toISOString()}));
  if(L.length)await fetch(C.url+'/rest/v1/leads?on_conflict=device_id,id',{method:'POST',headers:h(),body:JSON.stringify(L)});
 }catch(e){}}
 // hooks (no names/phones/emails of contacts leave the device; only company, stage, value, city)
 const wrap=(n,f)=>{const o=window[n];if(typeof o==='function')window[n]=function(...a){const r=o.apply(this,a);try{f(...a)}catch(e){}return r}};
 {const o=window.setStage;window.setStage=function(id,s){const f=(typeof lead==='function'?lead(id)?.stage:null);const r=o.apply(this,arguments);if(f&&f!==s)track('move',{lead_id:id,from_stage:f,to_stage:s});return r}}
 wrap('doSearch',()=>track('search'));wrap('enrichSel',()=>track('enrich'));wrap('importSel',()=>track('import'));wrap('paidUse',(p,u,c)=>track('lookup',{units:u,cost:c,meta:{provider:p}}));
 document.addEventListener('click',e=>{const a=e.target.closest('a[href^="tel:"],a[href^="sms:"]');if(a)track(a.href.startsWith('tel:')?'call':'text',{lead_id:a.closest('.card')?.dataset.id||null})},true);
 track('session');setInterval(flush,60000);addEventListener('visibilitychange',()=>document.hidden&&flush());setTimeout(flush,3000);
 window.SYNC={cfg:C,set(o){Object.assign(C,o);localStorage.setItem(SK,JSON.stringify(C))},flush,queue:()=>q};
 // Settings UI
 const add=()=>{const el=document.querySelector('#v-settings');if(!el||el.querySelector('#sync-panel'))return;el.insertAdjacentHTML('beforeend',`<div class="panel" id="sync-panel"><h2>Share usage with Danny (opt-in)</h2><p class="muted">Off by default. When on, sends usage counts and lead company/stage/value (no contact names, phones or emails) to Danny's Supabase.</p><label><input type="checkbox" id="sy-on" style="width:auto" ${C.on?'checked':''}> Share usage</label><div class="grid"><div><label>Supabase URL</label><input id="sy-url" value="${C.url}" placeholder="https://xxxx.supabase.co"></div><div><label>Anon key</label><input id="sy-key" value="${C.key}"></div></div><div class="acts"><button id="sy-save" class="pri">Save</button><span class="muted">${q.length} events queued</span></div></div>`);
  el.querySelector('#sy-save').onclick=()=>{SYNC.set({on:el.querySelector('#sy-on').checked,url:el.querySelector('#sy-url').value.trim().replace(/\/$/,''),key:el.querySelector('#sy-key').value.trim()});flush();toast('Sync settings saved')}};
 new MutationObserver(add).observe(document.querySelector('#v-settings'),{childList:true});add();
})();
