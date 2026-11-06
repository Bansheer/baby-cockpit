/* ===== push.js – Push-Mitteilungen pro Gerät, mit einstellbaren Kategorien =====
   Abo und Einstellungen liegen in der Sammlung "push" (ein Dokument je Gerät).
   Versand macht die Supabase-Funktion "push" (Fristen morgens, Wehen/Geburt sofort, Aktivität des Partners). */

const PUSH_CATS = [
  ["fristen", "Fristen & Termine", "Morgens um 8 Uhr: was heute und morgen fällig ist, kritische Fristen 3 Tage vorher", true],
  ["wehen",   "Wehen & Geburt",    "Sofort: Wehen-Timer gestartet, Zeit loszufahren, Blasensprung, Baby ist da – auch nachts", true],
  ["partner", "Aktivität des Partners", "Sofort: neue oder erledigte Aufgaben und Entscheidungen", false],
  ["ruhe",    "Ruhezeit 22–7 Uhr", "Keine Aktivitäts-Mitteilungen in der Nacht (Wehen & Geburt kommen trotzdem)", true]
];
let pushState = { supported:false, standalone:false, perm:"default", subId:null, busy:false, msg:"" };

const b64ToU8 = b => { const p = "=".repeat((4 - b.length % 4) % 4), s = atob((b + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, c => c.charCodeAt(0)); };
async function subIdOf(endpoint){ const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)); return [...new Uint8Array(h)].slice(0, 16).map(x => x.toString(16).padStart(2, "0")).join(""); }
function myPushDoc(){ return pushState.subId ? (state.push || []).find(p => p.id === pushState.subId) : null; }

async function pushInit(){
  pushState.supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  pushState.standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  pushState.perm = pushState.supported ? Notification.permission : "unsupported";
  if(pushState.supported){
    try{ const reg = await navigator.serviceWorker.ready; const s = await reg.pushManager.getSubscription(); if(s) pushState.subId = await subIdOf(s.endpoint); }catch(e){}
  }
  renderPush();
}

function renderPush(){
  const el = document.getElementById("pushBox"); if(!el) return;
  const doc = myPushDoc(), prefs = doc?.prefs || {};
  if(!pushState.supported){
    el.innerHTML = pushState.standalone ? `<p>Dieses Gerät unterstützt keine Mitteilungen (ab iOS 16.4 möglich).</p>`
      : `<p>Mitteilungen funktionieren auf dem iPhone nur in der App vom Home-Bildschirm (Safari → Teilen → „Zum Home-Bildschirm“).</p>`;
    return;
  }
  if(!doc){
    el.innerHTML = `<p>Mitteilungen auf diesem Gerät sind aus. Du wählst danach selbst, welche du bekommst.</p>
      ${pushState.perm === "denied" ? `<p class="lb-foot">Mitteilungen wurden abgelehnt. Erlauben unter iPhone-Einstellungen → Mitteilungen → Baby-Cockpit.</p>` : ""}
      <div class="set-row"><button class="btn" id="pushOn" ${pushState.busy ? "disabled" : ""}>Mitteilungen aktivieren</button></div>${pushState.msg ? `<p class="lb-foot">${esc(pushState.msg)}</p>` : ""}`;
    return;
  }
  el.innerHTML = `
    <div class="push-list">${PUSH_CATS.map(([k, t, d, def]) => `<label class="push-row"><span><b>${t}</b><small>${d}</small></span>
      <input type="checkbox" class="tgl" data-pref="${k}" ${(prefs[k] ?? def) ? "checked" : ""}></label>`).join("")}
      <label class="push-row"><span><b>Auch Fristen der anderen Person</b><small>Sonst nur deine und gemeinsame („Beide“)</small></span>
      <input type="checkbox" class="tgl" data-pref="alle" ${prefs.alle ? "checked" : ""}></label></div>
    <div class="set-row"><button class="btn sec" id="pushTest">Testmitteilung</button><button class="btn danger" id="pushOff">Auf diesem Gerät ausschalten</button></div>
    ${pushState.msg ? `<p class="lb-foot">${esc(pushState.msg)}</p>` : ""}`;
}

async function pushEnable(){
  pushState.busy = true; pushState.msg = ""; renderPush();
  try{
    const key = state.pushKey; if(!key) throw new Error("Push ist auf dem Server noch nicht eingerichtet (SQL-Update 1.6).");
    const perm = await Notification.requestPermission(); pushState.perm = perm;
    if(perm !== "granted") throw new Error("Ohne Erlaubnis keine Mitteilungen.");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64ToU8(key)});
    pushState.subId = await subIdOf(sub.endpoint);
    const prefs = Object.fromEntries(PUSH_CATS.map(([k,,, def]) => [k, def]));
    await db.doc(`push/${pushState.subId}`).set({name: me || "", sub: sub.toJSON(), prefs, device: navigator.userAgent.slice(0, 120), since: new Date().toISOString()});
    pushState.msg = "Aktiviert. Probier die Testmitteilung.";
  }catch(e){ pushState.msg = e.message || String(e); }
  pushState.busy = false; renderPush();
}
async function pushDisable(){
  try{ const reg = await navigator.serviceWorker.ready; const s = await reg.pushManager.getSubscription(); await s?.unsubscribe(); }catch(e){}
  if(pushState.subId) await db.doc(`push/${pushState.subId}`).delete();
  pushState.subId = null; pushState.msg = "Mitteilungen auf diesem Gerät ausgeschaltet."; renderPush();
}
async function pushTest(){
  pushState.msg = "Sende …"; renderPush();
  try{
    const {data:{session}} = await sb.auth.getSession();
    const r = await fetch(`${CFG.url.replace(/\/$/, "")}/functions/v1/push`, {method:"POST",
      headers:{"Content-Type":"application/json", apikey:CFG.key, Authorization:`Bearer ${session?.access_token || ""}`},
      body:JSON.stringify({type:"test", id:pushState.subId})});
    pushState.msg = r.ok ? "Testmitteilung gesendet – sie sollte gleich erscheinen." : `Fehler: ${await r.text()}`;
  }catch(e){ pushState.msg = "Funktion „push“ nicht erreichbar – ist sie in Supabase eingerichtet?"; }
  renderPush();
}

document.addEventListener("click", e => {
  const id = e.target.id;
  if(id === "pushOn") pushEnable();
  if(id === "pushOff") pushDisable();
  if(id === "pushTest") pushTest();
});
document.addEventListener("change", e => {
  const c = e.target.closest("[data-pref]"); if(!c || !pushState.subId) return;
  const doc = myPushDoc(); const prefs = {...(doc?.prefs || {}), [c.dataset.pref]: c.checked};
  db.doc(`push/${pushState.subId}`).update({prefs, name: me || doc?.name || ""});
});

// Antippen einer Mitteilung öffnet die passende Ansicht (#aufgaben, #wehen, #log)
function openFromHash(){
  const h = location.hash.replace("#", ""); if(!h) return;
  if(h === "wehen" && window.openLabor) openLabor();
  else if(["aufgaben","log","einkauf","wissen","besprechen","heute"].includes(h)) show(h);
  history.replaceState(null, "", location.pathname);
}
navigator.serviceWorker?.addEventListener("message", e => { if(e.data?.open){ location.hash = e.data.open; openFromHash(); } });
