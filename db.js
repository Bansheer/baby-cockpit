/* ===== db.js – Datenschicht: Supabase, Offline-Cache, Warteschlange, Einstellungen =====
   Gleiche Schnittstelle wie zuvor für app.js:
   db.collection(c).onSnapshot/add · db.doc("c/id").get/set/update/delete/onSnapshot
   Alle Daten liegen in der Tabelle "docs" (col, id, data jsonb, updated_by, updated_at).
   Änderungen werden sofort lokal angewendet und über eine Warteschlange übertragen,
   damit die App auch offline (Kreißsaal, Funkloch) weiter funktioniert. */

const APP_VERSION = "1.1.0";
const CFG = window.COCKPIT_CONFIG || {};
const CONFIGURED = !!(CFG.url && CFG.key && !CFG.url.includes("DEIN-PROJEKT"));

/* ---------- Lokaler Speicher (abgesichert, falls blockiert) ---------- */
const LS = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} }
};
const K = { cache:"bc.cache.v1", outbox:"bc.outbox.v1", me:"bc.me", last:"bc.lastSync" };

let sb = null;
let cache = LS.get(K.cache, {});      // { col: { id: {data, by, at} } }
let outbox = LS.get(K.outbox, []);    // [{op, col, id, data, by, at}]
const listeners = [];
const sync = { online: navigator.onLine, busy: false, last: LS.get(K.last, null), error: "" };
let me = LS.get(K.me, "");            // "Lena" | "Hannes"
let swReg = null;

/* ---------- Hilfen ---------- */
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clean = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !k.startsWith("_")));
const isNetErr = (res, e) => !!e || !res || res.status === 0 || /fetch|network/i.test(res.error?.message || "");
const saveCache = () => LS.set(K.cache, cache);
const saveOutbox = () => LS.set(K.outbox, outbox);

/* ---------- Snapshots an app.js liefern ---------- */
function rowsOf(col){ return Object.entries(cache[col] || {}).map(([id, r]) => ({id, r})); }
function emit(col){
  listeners.filter(l => !col || l.col === col).forEach(l => {
    try{
      if(l.id){
        const r = cache[l.col]?.[l.id];
        l.cb({exists:!!r, data:() => r ? {...r.data, _by:r.by, _at:r.at} : undefined});
      } else {
        l.cb({docs: rowsOf(l.col).map(({id, r}) => ({id, data:() => ({...r.data, _by:r.by, _at:r.at})}))});
      }
    }catch(e){ console.error(e); }
  });
}

/* ---------- Änderungen lokal anwenden ---------- */
function applyLocal(op){
  cache[op.col] = cache[op.col] || {};
  if(op.op === "delete") delete cache[op.col][op.id];
  else if(op.op === "merge"){ const cur = cache[op.col][op.id]?.data || {}; cache[op.col][op.id] = {data:{...cur, ...op.data}, by:op.by, at:op.at}; }
  else cache[op.col][op.id] = {data:{...op.data}, by:op.by, at:op.at};
}
function queue(op){
  op.by = me || ""; op.at = new Date().toISOString(); op.data = clean(op.data);
  outbox.push(op); saveOutbox(); applyLocal(op); saveCache(); emit(op.col); status(); flush();
}

/* ---------- Warteschlange an Supabase senden ---------- */
async function send(op){
  if(op.op === "upsert") return sb.from("docs").upsert({col:op.col, id:op.id, data:op.data, updated_by:op.by || null, updated_at:op.at});
  if(op.op === "merge")  return sb.rpc("merge_doc", {p_col:op.col, p_id:op.id, p_patch:op.data, p_by:op.by || null});
  if(op.op === "delete") return sb.from("docs").delete().eq("col", op.col).eq("id", op.id);
}
let flushing = false;
async function flush(){
  if(flushing || !sb || !outbox.length) return;
  flushing = true; sync.busy = true; status();
  let sent = 0;
  while(outbox.length){
    let res, err; try{ res = await send(outbox[0]); }catch(e){ err = e; }
    if(isNetErr(res, err)){ sync.online = false; break; }
    if(res.error){ sync.error = "Eine Änderung wurde vom Server abgelehnt (" + (res.error.message || "Fehler") + ")."; console.error(res.error); }
    outbox.shift(); saveOutbox(); sent++; sync.online = true;
  }
  flushing = false; sync.busy = false;
  if(sent) await refresh(); else status();
}

/* ---------- Daten vom Server holen ---------- */
let refreshing = null;
async function refresh(){
  if(!sb) return;
  if(refreshing) return refreshing;
  refreshing = (async () => {
    const cols = [...new Set(listeners.map(l => l.col))];
    let res, err;
    try{ res = await sb.from("docs").select("col,id,data,updated_by,updated_at").in("col", cols); }catch(e){ err = e; }
    if(isNetErr(res, err) || res.error){ sync.online = !isNetErr(res, err); if(res?.error && sync.online) sync.error = res.error.message; status(); return; }
    const next = {};
    cols.forEach(c => next[c] = {});
    res.data.forEach(r => { (next[r.col] = next[r.col] || {})[r.id] = {data:r.data || {}, by:r.updated_by || "", at:r.updated_at}; });
    cache = next;
    outbox.forEach(applyLocal);           // noch nicht übertragene Änderungen bleiben sichtbar
    saveCache(); sync.online = true; sync.error = ""; sync.last = new Date().toISOString(); LS.set(K.last, sync.last);
    emit(); status();
  })();
  try{ await refreshing; } finally { refreshing = null; }
}

/* ---------- Schnittstelle für app.js ---------- */
function makeDb(){
  return {
    collection(col){ return {
      onSnapshot(cb, err){ listeners.push({col, cb, err}); if(cache[col]) emit(col); },
      async add(data){ queue({op:"upsert", col, id:newId(), data}); }
    }; },
    doc(path){
      const [col, id] = path.split("/");
      return {
        async get(){ const r = cache[col]?.[id]; return {exists:!!r, data:() => r ? {...r.data} : undefined}; },
        async set(d){ queue({op:"upsert", col, id, data:d}); },
        async update(d){ queue({op:"merge", col, id, data:d}); },
        async delete(){ queue({op:"delete", col, id}); },
        onSnapshot(cb, err){ listeners.push({col, id, cb, err}); if(cache[col]) emit(col); }
      };
    }
  };
}

/* ---------- Statuszeile ---------- */
function status(){
  const n = outbox.length;
  let t;
  if(!sync.online) t = n ? `Offline – ${n} ${n===1?"Änderung wird":"Änderungen werden"} übertragen, sobald wieder Netz da ist.` : "Offline – gespeicherter Stand wird angezeigt.";
  else if(sync.busy || n) t = "Speichere …";
  else t = "Synchronisiert" + (sync.last ? " · " + stamp(sync.last) : "") + " – Änderungen sehen Lena und Hannes sofort.";
  if(sync.error) t += " " + sync.error;
  if(typeof note === "function") note(t);
  if(window.renderSettings) renderSettings();
}

/* ---------- Wer bin ich? ---------- */
async function setMe(name){
  me = name; LS.set(K.me, name);
  try{ await sb?.auth.updateUser({data:{name}}); }catch(e){}
  renderSettings();
}
function askWho(){
  openSheet(`<h3 id="sheetTitle">Wer bist du?</h3><p>Damit ihr bei jeder Änderung seht, wer sie gemacht hat.</p>
    <div class="who-pick"><button class="btn" data-me="Lena">Lena</button><button class="btn" data-me="Hannes">Hannes</button></div>`);
}
document.addEventListener("click", e => { const b = e.target.closest("[data-me]"); if(b){ setMe(b.dataset.me); closeSheet(); } });

/* ---------- Kalender (ICS) ---------- */
function icsEscape(s){ return String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }
function icsFold(line){ const out = []; let s = line; while(s.length > 73){ out.push(s.slice(0, 73)); s = " " + s.slice(73); } out.push(s); return out.join("\r\n"); }
function buildICS(tasks){
  const d8 = iso => iso.replace(/-/g, "");
  const plus1 = iso => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ""); };
  const now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Baby-Cockpit//DE", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Baby-Cockpit"];
  tasks.filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t.sort || "")).forEach(t => {
    const done = t.status === "Erledigt";
    lines.push("BEGIN:VEVENT", `UID:${t.id}@baby-cockpit`, `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${d8(t.sort)}`, `DTEND;VALUE=DATE:${plus1(t.sort)}`,
      icsFold(`SUMMARY:${icsEscape((done ? "✓ " : "") + t.title + (t.who ? " · " + t.who : ""))}`),
      icsFold(`DESCRIPTION:${icsEscape([t.status, t.note].filter(Boolean).join(" – "))}`),
      "TRANSP:TRANSPARENT", "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
function calUrl(){
  const tok = cache.content?.calendar?.data?.token;
  if(!tok || !CONFIGURED) return "";
  return CFG.url.replace(/^https?:\/\//, "").replace(/\/$/, "") + "/functions/v1/calendar?token=" + encodeURIComponent(tok);
}
function download(name, text, type){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], {type}));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ---------- Einstellungen (Log → „App, Kalender & Backup“) ---------- */
function renderSettings(){
  const el = document.getElementById("appBody"); if(!el) return;
  const meta = document.getElementById("appMeta");
  const dot = !sync.online ? "off" : (sync.busy || outbox.length) ? "busy" : "";
  if(meta) meta.innerHTML = `<span class="sync-dot ${dot}"></span>${sync.online ? (outbox.length ? "speichert" : "online") : "offline"}`;
  if(el.contains(document.activeElement)) return;   // nicht neu zeichnen, während jemand tippt
  const cal = calUrl();
  el.innerHTML = `
    <h4>Ich bin</h4>
    <div class="seg" role="group" aria-label="Ich bin">${["Lena","Hannes"].map(n => `<button data-me="${n}" aria-pressed="${me===n}">${n}</button>`).join("")}</div>
    <h4>Kalender aufs iPhone</h4>
    ${cal ? `<p>Alle Aufgaben mit Datum erscheinen automatisch in eurem Apple-Kalender und aktualisieren sich von selbst.</p>
      <div class="set-row"><a class="btn" href="webcal://${esc(cal)}">Kalender abonnieren</a><button class="btn sec" id="copyCal">Link kopieren</button></div>`
      : `<p>Das Kalender-Abo ist noch nicht eingerichtet (Schritt „Edge Function“ in der Anleitung).</p>`}
    <div class="set-row"><button class="btn sec" id="icsDl">Termine einmalig als Datei (.ics)</button></div>
    <h4>Sicherung</h4>
    <p>Alle Daten als Datei speichern, z. B. einmal im Monat in iCloud.</p>
    <div class="set-row"><button class="btn sec" id="exportJson">Backup herunterladen</button></div>
    <h4>Status</h4>
    <p>${sync.online ? "Online" : "Offline"} · ${outbox.length} ausstehende Änderungen · letzter Abgleich ${sync.last ? esc(stamp(sync.last)) : "–"}<br>Version ${APP_VERSION}</p>
    <div class="set-row"><button class="btn sec" id="syncNow">Jetzt abgleichen</button><button class="btn sec" id="checkUpdate">Nach Update suchen</button><button class="btn danger" id="logout">Abmelden</button></div>`;
}
document.getElementById("appBody")?.addEventListener("click", async e => {
  const id = e.target.id;
  if(id === "copyCal"){ try{ await navigator.clipboard.writeText("webcal://" + calUrl()); e.target.textContent = "Kopiert ✓"; }catch(err){ prompt("Link kopieren:", "webcal://" + calUrl()); } }
  if(id === "icsDl") download("baby-cockpit-termine.ics", buildICS(state.tasks), "text/calendar");
  if(id === "exportJson"){
    const docs = Object.entries(cache).flatMap(([col, m]) => Object.entries(m).map(([id, r]) => ({col, id, data:r.data, updated_by:r.by, updated_at:r.at})));
    download(`baby-cockpit-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({app:"Baby-Cockpit", version:APP_VERSION, exported_at:new Date().toISOString(), docs}, null, 1), "application/json");
  }
  if(id === "syncNow"){ await flush(); await refresh(); }
  if(id === "checkUpdate"){ e.target.textContent = "Suche …"; try{ await swReg?.update(); }catch(err){} setTimeout(() => { e.target.textContent = "Aktuell ✓"; }, 1200); }
  if(id === "logout" && confirm("Abmelden? Nicht übertragene Änderungen gehen verloren.")){
    try{ await sb.auth.signOut(); }catch(err){}
    [K.cache, K.outbox, K.last].forEach(LS.del); location.reload();
  }
});

/* ---------- Service Worker: offline + Update-Hinweis ---------- */
function showUpdateToast(worker){
  if(document.getElementById("updToast")) return;
  const b = document.createElement("button");
  b.id = "updToast"; b.className = "toast"; b.textContent = "Neue Version verfügbar – tippen zum Aktualisieren";
  b.onclick = () => worker.postMessage("skipWaiting");
  document.body.appendChild(b);
}
if("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")){
  navigator.serviceWorker.register("sw.js").then(reg => {
    swReg = reg;
    if(reg.waiting && navigator.serviceWorker.controller) showUpdateToast(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w?.addEventListener("statechange", () => { if(w.state === "installed" && navigator.serviceWorker.controller) showUpdateToast(w); });
    });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if(!reloaded){ reloaded = true; location.reload(); } });
}

/* ---------- Start ---------- */
let started = false;
async function startApp(session){
  if(started) return; started = true;
  document.getElementById("login").classList.remove("show");
  db = makeDb();
  const sub = (col, key) => db.collection(col).onSnapshot(s => { state[key] = s.docs.map(d => ({id:d.id, ...d.data()})); renderAll(); });
  sub("tasks","tasks"); sub("talk","talk"); sub("questions","questions"); sub("log","log"); sub("shopExtra","shopExtra");
  db.doc("state/shop").onSnapshot(s => { state.shop = s.exists ? clean(s.data()) : {}; renderShop(); renderHome(); });
  db.doc("state/checks").onSnapshot(s => { state.checks = s.exists ? clean(s.data()) : {}; renderWissen(); });
  db.doc("content/wissen").onSnapshot(s => { WISSEN = s.exists ? (s.data().items || []) : []; renderWissen(); });
  db.doc("content/calendar").onSnapshot(() => renderSettings());
  const metaName = session?.user?.user_metadata?.name;
  if(metaName && !me){ me = metaName; LS.set(K.me, me); }
  renderSettings(); status();
  await flush(); await refresh();
  if(!me) askWho();
  // Live-Updates; iPhone pausiert Verbindungen im Hintergrund → beim Zurückkommen nachladen
  let t = null;
  sb.channel("docs").on("postgres_changes", {event:"*", schema:"public", table:"docs"}, () => { clearTimeout(t); t = setTimeout(refresh, 300); }).subscribe();
  document.addEventListener("visibilitychange", () => { if(!document.hidden){ flush(); refresh(); } });
  window.addEventListener("online", () => { sync.online = true; flush(); refresh(); });
  window.addEventListener("offline", () => { sync.online = false; status(); });
  setInterval(() => { if(!document.hidden){ flush(); refresh(); } }, 60000);
}

document.getElementById("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = document.getElementById("loginErr"); err.textContent = "";
  const {data, error} = await sb.auth.signInWithPassword({email:document.getElementById("loginMail").value.trim(), password:document.getElementById("loginPw").value});
  if(error){ err.textContent = /fetch|network/i.test(error.message) ? "Keine Verbindung. Bitte mit Internet erneut versuchen." : "Anmeldung fehlgeschlagen. E-Mail oder Passwort prüfen."; return; }
  startApp(data.session);
});

(async () => {
  renderSettings();
  if(!CONFIGURED){ note("config.js ist noch nicht ausgefüllt."); return; }
  sb = window.supabase.createClient(CFG.url, CFG.key, {auth:{persistSession:true, autoRefreshToken:true}});
  let session = null;
  try{ ({data:{session}} = await sb.auth.getSession()); }catch(e){}
  // Mit gespeicherter Sitzung oder (offline) mit gespeicherten Daten sofort starten
  if(session || (!navigator.onLine && Object.keys(cache).length)) startApp(session);
  else { document.getElementById("login").classList.add("show"); note("Bitte anmelden."); }
})();
