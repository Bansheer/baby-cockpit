/* ===== birth.js – Geburtsmodus: Wehen-Timer, Geburt eintragen, Fristen, Geburtskarte =====
   Daten: Sammlung "wehen" ({start, end} bzw. {type:"blase", at}) und Dokument "state/baby".
   Läuft live auf beiden iPhones: Startet Lena eine Wehe, sieht Hannes sie sofort. */

state.wehen = state.wehen || [];
state.baby = state.baby || {};

const CLINICS = {
  meran: {name:"KH Meran", tel:"+390473264140", telShow:"0473 264 140", map:"https://maps.apple.com/?daddr=Krankenhaus%20Meran,%20Rossinistra%C3%9Fe%205,%20Meran"},
  bozen: {name:"KH Bozen", tel:"+390471438624", telShow:"0471 438 624", map:"https://maps.apple.com/?daddr=Krankenhaus%20Bozen,%20Lorenz-B%C3%B6hler-Stra%C3%9Fe%205,%20Bozen"}
};
let laborOpen = false, laborTick = null, wakeLock = null;

/* ---------- Hilfen ---------- */
const mmss = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`; };
const hhmm = iso => new Date(iso).toLocaleTimeString("de-DE", {hour:"2-digit", minute:"2-digit"});
const isoDay = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function contractions(){ return state.wehen.filter(w => !w.type && w.start).sort((a,b) => a.start.localeCompare(b.start)); }
function running(){ return contractions().find(w => !w.end); }

/* ---------- Auswertung: Abstand, Dauer, 5-1-1-Regel ---------- */
function laborStats(){
  const now = Date.now();
  const all = contractions();
  const done = all.filter(w => w.end);
  const win = (min) => done.filter(w => now - new Date(w.start) <= min*60e3);
  const avg = a => a.length ? a.reduce((s,x) => s+x, 0) / a.length : 0;
  const durs = list => list.map(w => (new Date(w.end) - new Date(w.start)) / 1000);
  const gaps = list => list.slice(1).map((w,i) => (new Date(w.start) - new Date(list[i].start)) / 1000);
  const h = win(65), half = win(30), ten = done.filter(w => now - new Date(w.start) <= 10*60e3);
  const st = { count60: h.length, avgDur: avg(durs(h)), avgGap: avg(gaps(h)), level: "start" };
  const span = h.length > 1 ? (new Date(h[h.length-1].start) - new Date(h[0].start)) / 60e3 : 0;
  const r = all.find(w => !w.end);
  if(ten.length >= 6 || durs(done.slice(-1)).some(d => d > 120) || (r && now - new Date(r.start) > 120e3)) st.level = "urgent";
  else if(h.length >= 6 && span >= 50 && st.avgGap <= 330 && st.avgDur >= 55) st.level = "go";
  else if(half.length >= 3 && avg(gaps(half)) <= 420) st.level = "ready";
  else if(all.length) st.level = "early";
  st.blase = state.wehen.find(w => w.type === "blase");
  return st;
}
const ADVICE = {
  start: ["", "Tippe beim Beginn und am Ende jeder Wehe. Der Timer rechnet Dauer und Abstand aus."],
  early: ["", "Noch Zeit: ausruhen, trinken, warm duschen. Weiter mitzählen."],
  ready: ["ready", "Die Wehen werden regelmäßig. Tasche ins Auto, Babyschale prüfen, Kreißsaal vorab anrufen."],
  go:    ["go", "Wehen regelmäßig alle ~5 Minuten seit einer Stunde: Jetzt Kreißsaal anrufen und losfahren. (NHS: anrufen bei regelmäßigen Wehen alle 5 Min. oder öfter)"],
  urgent:["go", "Dringend: 6 oder mehr Wehen in 10 Minuten oder eine Wehe länger als 2 Minuten – sofort Kreißsaal anrufen."]
};

/* ---------- Leiste auf der Startseite ---------- */
function renderBirthBar(){
  const el = document.getElementById("birthBar"); if(!el) return;
  if(state.baby.born){
    el.innerHTML = `<button class="bb-btn" id="bbCard"><span aria-hidden="true">💌</span>Geburtskarte teilen</button><button class="bb-btn" data-breath=""><span aria-hidden="true">🌬</span>Atmen</button><button class="bb-btn" id="bbEdit"><span aria-hidden="true">✏️</span>Geburtsdaten</button>`;
    return;
  }
  const r = running(), n = contractions().length;
  el.innerHTML = `<button class="bb-btn ${r?"live":""}" id="bbLabor"><span aria-hidden="true">⏱</span>${r ? "Wehe läuft …" : "Wehen-Timer"}${n && !r ? `<small>${n}</small>` : ""}</button><button class="bb-btn" data-breath=""><span aria-hidden="true">🌬</span>Atmen</button><button class="bb-btn" id="bbBorn"><span aria-hidden="true">👶</span>Baby ist da</button>`;
}

/* ---------- Wehen-Timer (Vollbild) ---------- */
function renderLabor(){
  const el = document.getElementById("labor"); if(!el || !laborOpen) return;
  const r = running(), st = laborStats(), list = contractions().slice().reverse().slice(0, 12);
  const [cls, txt] = ADVICE[st.level];
  const rows = list.map((w, i) => {
    const prev = list[i+1];
    const dur = w.end ? mmss((new Date(w.end) - new Date(w.start)) / 1000) : "läuft";
    const gap = prev ? mmss((new Date(w.start) - new Date(prev.start)) / 1000) : "–";
    return `<tr><td>${hhmm(w.start)}</td><td>${dur}</td><td>${gap}</td><td><button class="lb-del" data-wdel="${esc(w.id)}" aria-label="Wehe ${hhmm(w.start)} löschen">×</button></td></tr>`;
  }).join("");
  el.innerHTML = `
    <div class="lb-head"><h2 id="laborTitle">Wehen-Timer</h2><button class="icon-btn" id="laborClose" aria-label="Schließen">✕</button></div>
    <div class="lb-advice ${cls}" role="status">${esc(txt)}</div>
    ${st.blase ? `<div class="lb-advice go">Blasensprung um ${hhmm(st.blase.at)}: Kreißsaal anrufen – Farbe und Menge merken.</div>` : ""}
    <button class="lb-big ${r?"on":""}" id="laborToggle" aria-live="polite">
      <span class="lb-big-t">${r ? "Wehe vorbei" : "Wehe beginnt"}</span>
      ${r ? `<span class="lb-big-s" id="laborClock">${mmss((Date.now() - new Date(r.start)) / 1000)}</span>` : `<span class="lb-big-h">beim Beginn tippen</span>`}
    </button>
    <div class="lb-stats">
      <div><b>${st.count60}</b><span>Wehen letzte Std.</span></div>
      <div><b>${st.avgDur ? mmss(st.avgDur) : "–"}</b><span>Ø Dauer</span></div>
      <div><b>${st.avgGap ? mmss(st.avgGap) : "–"}</b><span>Ø Abstand</span></div>
    </div>
    ${rows ? `<div class="tbl-wrap"><table class="tbl lb-tbl"><tr><th>Beginn</th><th>Dauer</th><th>Abstand</th><th></th></tr>${rows}</table></div>` : ""}
    <div class="lb-actions">
      ${Object.entries(CLINICS).map(([k,c]) => `<a class="btn ${k==="meran"?"":"sec"}" href="tel:${c.tel}">📞 Kreißsaal ${c.name.replace("KH ","")}</a>`).join("")}
      ${Object.entries(CLINICS).map(([k,c]) => `<a class="btn sec" href="${c.map}" target="_blank" rel="noopener">🚗 Route ${c.name.replace("KH ","")}</a>`).join("")}
      <button class="btn sec" id="laborShare">💬 Familie informieren</button>
      <button class="btn sec" id="laborBlase">💧 Blasensprung</button>
      <button class="btn sec" data-breath="wehe">🌊 Atemhilfe für die Wehe</button>
    </div>
    <p class="lb-foot">Sofort anrufen bei Blasensprung (besonders grünes, braunes oder blutiges Fruchtwasser), Blutung oder weniger Kindsbewegungen. Im Zweifel immer anrufen. Quellen: <a href="https://www.nhs.uk/pregnancy/labour-and-birth/signs-that-labour-has-begun/" target="_blank" rel="noopener">NHS – Signs that labour has begun</a>, <a href="https://www.nhs.uk/pregnancy/keeping-well/your-babys-movements/" target="_blank" rel="noopener">NHS – Baby movements</a>.</p>
    <div class="set-row"><button class="btn danger" id="laborReset">Fehlalarm: Liste leeren</button></div>`;
}
async function openLabor(){
  laborOpen = true;
  const el = document.getElementById("labor"); el.hidden = false; document.body.classList.add("noscroll");
  renderLabor(); document.getElementById("laborClose").focus();
  clearInterval(laborTick);
  laborTick = setInterval(() => { const r = running(), c = document.getElementById("laborClock"); if(r && c) c.textContent = mmss((Date.now() - new Date(r.start)) / 1000); }, 1000);
  try{ if("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); }catch(e){}   // Bildschirm bleibt an
}
function closeLabor(){
  laborOpen = false; clearInterval(laborTick);
  document.getElementById("labor").hidden = true; document.body.classList.remove("noscroll");
  try{ wakeLock?.release(); }catch(e){} wakeLock = null;
}
document.addEventListener("visibilitychange", async () => { if(laborOpen && !document.hidden){ try{ wakeLock = await navigator.wakeLock?.request("screen"); }catch(e){} } });

async function shareText(text){
  try{ if(navigator.share){ await navigator.share({text}); return; } }catch(e){ if(e.name === "AbortError") return; }
  location.href = "https://wa.me/?text=" + encodeURIComponent(text);
}

document.getElementById("labor").addEventListener("click", async e => {
  const t = e.target.closest("button"); if(!t) return;
  if(t.id === "laborClose") return closeLabor();
  if(t.id === "laborToggle"){
    const r = running();
    if(r) await db.doc(`wehen/${r.id}`).update({end:new Date().toISOString()});
    else await db.collection("wehen").add({start:new Date().toISOString(), end:null});
    return;
  }
  if(t.dataset.wdel){ await db.doc(`wehen/${t.dataset.wdel}`).delete(); return; }
  if(t.id === "laborBlase"){ if(confirm("Blasensprung jetzt eintragen?")) await db.collection("wehen").add({type:"blase", at:new Date().toISOString()}); return; }
  if(t.id === "laborShare"){ const st = laborStats(); return shareText(`Es geht los! 🤍 Die Wehen sind regelmäßig${st.avgGap ? ` (etwa alle ${Math.round(st.avgGap/60)} Minuten)` : ""}. Wir fahren bald ins Krankenhaus und melden uns, sobald es Neuigkeiten gibt.`); }
  if(t.id === "laborReset"){ if(confirm("Alle erfassten Wehen löschen?")) for(const w of state.wehen) await db.doc(`wehen/${w.id}`).delete(); return; }
});
document.addEventListener("keydown", e => { if(e.key === "Escape" && laborOpen) closeLabor(); });

/* ---------- Geburt eintragen ---------- */
function bornForm(){
  const b = state.baby, now = new Date(Date.now() - new Date().getTimezoneOffset()*60e3).toISOString().slice(0,16);
  openSheet(`<h3 id="sheetTitle">${b.born ? "Geburtsdaten" : "Willkommen, kleines Wunder 🤍"}</h3>
    <div class="field"><label for="bName">Vorname</label><input id="bName" value="${esc(b.name||"")}" autocomplete="off"></div>
    <div class="field"><label for="bBorn">Geboren am</label><input type="datetime-local" id="bBorn" value="${esc((b.born||now).slice(0,16))}"></div>
    <div class="grid2">
      <div class="field"><label for="bWeight">Gewicht (g)</label><input type="number" inputmode="numeric" id="bWeight" value="${esc(b.weight||"")}" placeholder="3400"></div>
      <div class="field"><label for="bLength">Größe (cm)</label><input type="number" inputmode="decimal" id="bLength" value="${esc(b.length||"")}" placeholder="51"></div>
    </div>
    <div class="field"><label for="bHead">Kopfumfang (cm, optional)</label><input type="number" inputmode="decimal" id="bHead" value="${esc(b.head||"")}"></div>
    <div class="field"><label for="bClinic">Klinik</label><select id="bClinic">${["KH Meran","KH Bozen","Andere"].map(c => `<option ${b.clinic===c?"selected":""}>${c}</option>`).join("")}</select></div>
    <button class="btn" id="bSave">Speichern</button>
    ${b.born ? "" : `<p class="lb-foot">Danach legt die App automatisch alle Fristen (Geburtsanmeldung, INPS, Assegno unico …) als Aufgaben an.</p>`}`);
}
function birthTasks(bornIso){
  const D = new Date(bornIso); D.setHours(12,0,0,0);
  const at = n => { const d = new Date(D); d.setDate(d.getDate()+n); return isoDay(d); };
  return [
    ["b01", 3,  "Geburt anmelden (Steuernummer kommt automatisch)", "Hannes", "Am einfachsten im Krankenhaus bis Tag 3, sonst in der Gemeinde Eppan bis Tag 10 (" + label(at(10)) + "). Dabei gleich den Windelbonus beantragen.", true],
    ["b02", 1,  "Hebamme Nathalie: Wochenbettbesuche vereinbaren", "Lena", ""],
    ["b03", 7,  "Kinderärztin wählen (Sprengel, mit Steuernummer)", "Hannes", "Erst nach der Geburtsanmeldung möglich."],
    ["b04", 7,  "Geburt beim Arbeitgeber melden + 10 Tage Vaterschaft festlegen", "Hannes", "Die 10 Tage sind bis 5 Monate nach der Geburt möglich."],
    ["b05", 14, "Vitamin-D-Präparat mit der Kinderärztin klären", "Lena", ""],
    ["b06", 30, "Geburtsdatum an INPS und Lenas Arbeitgeber melden", "Lena", "Frist 30 Tage, am besten über das Patronat.", true],
    ["b07", 30, "Assegno unico beantragen (Patronat)", "Beide", "Ohne ISEE = Mindestbetrag. IBAN des Familienkontos angeben."],
    ["b08", 30, "Mutual Help: Baby mitversichern, Leistungen klären", "Hannes", ""],
    ["b09", 60, "Landesfamiliengeld beantragen", "Beide", "Frist: 1 Jahr nach der Geburt."]
  ].map(([id, n, title, who, note, critical]) => ({id, data:{title, who, note, sort:at(n), when:"bis " + label(at(n)), status:"Offen", auto:"geburt", ...(critical ? {critical:true} : {})}}));
}
document.getElementById("sheet").addEventListener("click", async e => {
  if(e.target.id !== "bSave") return;
  const v = id => document.getElementById(id).value.trim();
  const data = {name:v("bName"), born:v("bBorn"), weight:v("bWeight"), length:v("bLength"), head:v("bHead"), clinic:v("bClinic")};
  if(!data.born){ alert("Bitte Datum und Uhrzeit angeben."); return; }
  const first = !state.baby.born;
  await db.doc("state/baby").set(data);
  // Fristen: nur fehlende Aufgaben anlegen; bei geändertem Datum die automatischen neu terminieren
  for(const t of birthTasks(data.born)){
    const cur = state.tasks.find(x => x.id === t.id);
    if(!cur) await db.doc(`tasks/${t.id}`).set(t.data);
    else if(cur.status !== "Erledigt" && cur.sort !== t.data.sort) await db.doc(`tasks/${t.id}`).update({sort:t.data.sort, when:t.data.when});
  }
  closeSheet();
  if(first){ closeLabor(); show("heute"); setTimeout(() => openSheet(`<h3 id="sheetTitle">Herzlichen Glückwunsch! 🎉</h3><p>Alle Fristen stehen jetzt unter Aufgaben. Wollt ihr die Geburtskarte teilen?</p><div class="set-row"><button class="btn" id="bbCard2">Geburtskarte teilen</button><button class="btn sec" id="bbMsg">Nur Text senden</button></div>`), 300); }
});

/* ---------- Startseite nach der Geburt ---------- */
function renderBornHero(){
  const b = state.baby, born = new Date(b.born);
  const days = Math.max(0, Math.floor((today() - new Date(born.getFullYear(), born.getMonth(), born.getDate())) / 864e5));
  document.getElementById("hcLabel").textContent = days < 1 ? "Heute geboren" : `${days} ${days===1?"Tag":"Tage"} alt`;
  document.getElementById("ssw").textContent = b.name || "Baby";
  document.getElementById("sswSub").textContent = `geboren ${born.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"})} · ${hhmm(b.born)} Uhr`;
  const pct = Math.min(days/42, 1), R = 36, C = 2*Math.PI*R;
  document.getElementById("ring").innerHTML = `<svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="${R}" fill="none" stroke="var(--accent-soft)" stroke-width="7"/><circle cx="42" cy="42" r="${R}" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(C*pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 42 42)"/></svg><div class="rv">${Math.min(days,42)}<small>von 42</small></div>`;
  const facts = [b.weight && `${Number(b.weight).toLocaleString("de-DE")} g`, b.length && `${b.length} cm`, b.head && `KU ${b.head} cm`].filter(Boolean).join(" · ");
  document.getElementById("babySize").innerHTML = `<span class="fruit" aria-hidden="true">🤍</span><span><span class="fz-t">${days < 42 ? `Wochenbett: Tag ${days+1} von 42` : "Wochenbett geschafft"}</span><span class="fz-s">${esc(facts || "Geburtsdaten ergänzen")}</span></span>`;
  document.getElementById("hcBand").hidden = true;
}

/* ---------- Geburtskarte als Bild ---------- */
async function birthCard(){
  const b = state.baby, born = new Date(b.born);
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1350;
  const g = c.getContext("2d");
  try{ await Promise.all(["600 150px Figtree","400 44px Figtree","600 56px Figtree"].map(f => document.fonts.load(f))); }catch(e){}
  const grad = g.createLinearGradient(0, 0, 1080, 1350); grad.addColorStop(0, "#FBF3F6"); grad.addColorStop(1, "#F2D3DF");
  g.fillStyle = grad; g.fillRect(0, 0, 1080, 1350);
  const heart = (x, y, s, a) => { g.save(); g.globalAlpha = a; g.fillStyle = "#C25A82"; g.beginPath(); g.moveTo(x, y + s*0.3);
    g.bezierCurveTo(x, y, x - s*0.5, y, x - s*0.5, y + s*0.3); g.bezierCurveTo(x - s*0.5, y + s*0.6, x, y + s*0.8, x, y + s);
    g.bezierCurveTo(x, y + s*0.8, x + s*0.5, y + s*0.6, x + s*0.5, y + s*0.3); g.bezierCurveTo(x + s*0.5, y, x, y, x, y + s*0.3); g.fill(); g.restore(); };
  [[140,170,70,.18],[930,240,50,.14],[880,1120,90,.12],[190,1080,46,.16],[540,1190,36,.35]].forEach(h => heart(...h));
  g.fillStyle = "#FFFFFF"; g.globalAlpha = .75; g.beginPath(); g.roundRect(90, 300, 900, 760, 48); g.fill(); g.globalAlpha = 1;
  g.textAlign = "center"; g.fillStyle = "#A8436B"; g.font = "600 44px Figtree, sans-serif"; g.fillText("Willkommen auf der Welt", 540, 410);
  g.fillStyle = "#2E1F28"; let fs = 150; g.font = `600 ${fs}px Figtree, sans-serif`;
  while(g.measureText(b.name || "Baby").width > 820 && fs > 70){ fs -= 8; g.font = `600 ${fs}px Figtree, sans-serif`; }
  g.fillText(b.name || "Baby", 540, 590);
  g.fillStyle = "#7A6570"; g.font = "400 40px Figtree, sans-serif";
  g.fillText(born.toLocaleDateString("de-DE", {weekday:"long", day:"numeric", month:"long", year:"numeric"}), 540, 680);
  g.fillText(`um ${hhmm(b.born)} Uhr${b.clinic && b.clinic !== "Andere" ? " · " + b.clinic.replace("KH","Krankenhaus") : ""}`, 540, 735);
  const facts = [b.weight && [Number(b.weight).toLocaleString("de-DE"), "Gramm"], b.length && [b.length, "Zentimeter"]].filter(Boolean);
  facts.forEach(([v, u], i) => { const x = facts.length === 1 ? 540 : 360 + i*360;
    g.fillStyle = "#F7E2EA"; g.beginPath(); g.arc(x, 880, 110, 0, Math.PI*2); g.fill();
    g.fillStyle = "#A8436B"; g.font = "600 56px Figtree, sans-serif"; g.fillText(v, x, 885);
    g.fillStyle = "#7A6570"; g.font = "400 30px Figtree, sans-serif"; g.fillText(u, x, 930); });
  g.fillStyle = "#A8436B"; g.font = "600 40px Figtree, sans-serif"; g.fillText("Lena & Hannes", 540, 1150);
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  const file = new File([blob], `geburtskarte-${(b.name||"baby").toLowerCase()}.png`, {type:"image/png"});
  try{ if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], text:birthText()}); return; } }catch(e){ if(e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
}
function birthText(){
  const b = state.baby, born = new Date(b.born);
  return `${b.name || "Unser Baby"} ist da! 🤍 Geboren am ${born.toLocaleDateString("de-DE")} um ${hhmm(b.born)} Uhr` +
    (b.weight ? `, ${Number(b.weight).toLocaleString("de-DE")} g` : "") + (b.length ? `, ${b.length} cm` : "") + ". Mama und Baby geht es gut. Lena & Hannes";
}

/* ---------- Klicks auf der Startseite und im Sheet ---------- */
document.addEventListener("click", e => {
  const t = e.target.closest("button"); if(!t) return;
  if(t.id === "bbLabor") openLabor();
  if(t.id === "bbBorn" || t.id === "bbEdit") bornForm();
  if(t.id === "bbCard" || t.id === "bbCard2") birthCard();
  if(t.id === "bbMsg") shareText(birthText());
});

function renderBirth(){ renderBirthBar(); renderLabor(); }
