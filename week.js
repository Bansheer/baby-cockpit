/* ===== week.js – Tagestipp (Mama/Papa) auf „Heute“ und Wochenansicht mit 3D-Frucht =====
   Inhalte und Quellen kommen aus content.js. Die 3D-Frucht (fruit3d.js + Three.js) wird erst beim Öffnen geladen. */

let tipRole = null;          // "m" | "v" – Standard aus „Ich bin“
let weekShown = null, fruitScene = null;

const srcLink = key => { const s = SRC[key]; if(!s) return ""; return s[1] ? `<a href="${esc(s[1])}" target="_blank" rel="noopener">${esc(s[0])}</a>` : esc(s[0]); };
const srcChip = key => { const s = SRC[key]; if(!s) return ""; const short = s[0].split(" – ")[0];
  return s[1] ? `<a class="src-chip" href="${esc(s[1])}" target="_blank" rel="noopener" title="${esc(s[0])}">${esc(short)}</a>` : `<span class="src-chip" title="${esc(s[0])}">${esc(short)}</span>`; };
function gestDay(){ return Math.round((today() - LMP) / 864e5); }
function myRole(){ const me = (typeof LS !== "undefined" && LS.get("bc.me", "")) || ""; return me === "Hannes" ? "v" : "m"; }

/* ---------- Tagestipp ---------- */
function renderDailyTip(){
  const el = document.getElementById("dailyTip"); if(!el) return;
  if(state.baby && state.baby.born){ el.hidden = true; return; }
  const gd = gestDay(), wk = Math.min(Math.max(Math.floor(gd / 7), 30), 41), day = ((gd % 7) + 7) % 7;
  const role = tipRole || myRole(), list = DAILY[wk][role], t = list[day];
  el.hidden = false;
  el.innerHTML = `
    <div class="tip-head"><h2 id="tipTitle">Heute für ${role === "m" ? "Lena" : "Hannes"}</h2>
      <div class="seg tip-seg" role="group" aria-label="Tipps für">${[["m","Lena"],["v","Hannes"]].map(([k,n]) => `<button data-tiprole="${k}" aria-pressed="${role===k}">${n}</button>`).join("")}</div></div>
    <span class="tip-tag">${esc(t[0])}</span>
    <p class="tip-text">${esc(t[1])}</p>
    <div class="tip-foot">${t[2] ? `<span>Quelle: <a href="${esc(SRC[t[2]][1])}" target="_blank" rel="noopener">${esc(SRC[t[2]][0].split(" – ")[0])}</a></span>` : `<span class="tip-prax">Praxis-Tipp</span>`}<button class="link-btn" data-tipweek="${wk}">Alle Tipps der Woche</button></div>`;
}
function tipWeekSheet(wk){
  const role = tipRole || myRole(), day = ((gestDay() % 7) + 7) % 7, cur = Math.floor(gestDay() / 7) === wk;
  openSheet(`<h3 id="sheetTitle">SSW ${wk}: Tipps für ${role === "m" ? "Lena" : "Hannes"}</h3>
    <ol class="tip-list">${DAILY[wk][role].map((t, i) => `<li class="${cur && i === day ? "now" : ""}"><span class="tip-tag">${esc(t[0])}</span><p>${esc(t[1])}</p><small>${t[2] ? "Quelle: " + srcLink(t[2]) : "Praxis-Tipp"}</small></li>`).join("")}</ol>`);
}
document.addEventListener("click", e => {
  const r = e.target.closest("[data-tiprole]"); if(r){ tipRole = r.dataset.tiprole; renderDailyTip(); return; }
  const w = e.target.closest("[data-tipweek]"); if(w){ tipWeekSheet(+w.dataset.tipweek); return; }
  const f = e.target.closest("#babySize"); if(f && !(state.baby && state.baby.born)){ openWeek(+f.dataset.week || 30); }
});

/* ---------- Wachstumskurve (SVG) ---------- */
function growthChart(wk){
  const ws = Object.keys(WEEKS).map(Number), W = 340, H = 150, P = {l:34, r:10, t:12, b:24};
  const x = n => P.l + (n - 28) / 14 * (W - P.l - P.r), y = g => H - P.b - g / 4000 * (H - P.t - P.b);
  const pts = ws.map(n => `${x(n).toFixed(1)},${y(WEEKS[n].g).toFixed(1)}`).join(" ");
  const cur = WEEKS[wk];
  let s = `<svg viewBox="0 0 ${W} ${H}" class="growth" role="img" aria-label="Gewichtskurve SSW 28 bis 42, aktuell ${cur.g} Gramm">`;
  [0,1000,2000,3000,4000].forEach(g => { s += `<line x1="${P.l}" x2="${W-P.r}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line)"/><text x="${P.l-6}" y="${y(g)+4}" text-anchor="end" font-size="10" fill="var(--muted)">${g/1000} kg</text>`; });
  [28,30,32,34,36,38,40,42].forEach(n => { s += `<text x="${x(n)}" y="${H-6}" text-anchor="middle" font-size="10" fill="var(--muted)">${n}</text>`; });
  s += `<polyline points="${P.l},${H-P.b} ${pts} ${x(42)},${H-P.b}" fill="var(--accent-soft)" stroke="none"/>`;
  s += `<polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>`;
  s += `<line x1="${x(wk)}" x2="${x(wk)}" y1="${P.t}" y2="${H-P.b}" stroke="var(--accent)" stroke-dasharray="3 3"/>`;
  s += `<circle cx="${x(wk)}" cy="${y(cur.g)}" r="6" fill="var(--accent)" stroke="var(--surface)" stroke-width="2.5"/>`;
  return s + `</svg>`;
}

/* ---------- Wochenansicht ---------- */
function renderWeek(){
  const el = document.getElementById("weekView"), wk = weekShown, W = WEEKS[wk], prev = WEEKS[wk - 1];
  const nowWk = Math.floor(gestDay() / 7), daysLeft = Math.round((ET - today()) / 864e5);
  const used = [...new Set([...W.baby, ...W.mama].map(f => f[1]).concat(["who", "nhs" + Math.min(wk, 41)]))];
  el.innerHTML = `
    <div class="lb-head"><button class="icon-btn ghost" data-wk="${wk-1}" ${wk<=28?"disabled":""} aria-label="Vorherige Woche">‹</button>
      <h2 id="weekTitle">SSW ${wk}${wk === nowWk ? ` <small>· jetzt</small>` : ""}</h2>
      <button class="icon-btn ghost" data-wk="${wk+1}" ${wk>=42?"disabled":""} aria-label="Nächste Woche">›</button>
      <button class="icon-btn" id="weekClose" aria-label="Schließen">✕</button></div>
    <div class="fruit-stage" id="fruitStage"><img class="fruit-img" src="img/w${Math.min(Math.max(wk,28),40)}.png" alt=""><span class="fruit-spark" aria-hidden="true"></span></div>
    <p class="fruit-name">So groß wie ${esc(/^(kleine|Bund)/.test(W.fruit) ? (W.fruit.startsWith("kleine") ? "eine " : "ein ") + W.fruit : artikel(W.fruit))} <span class="drag-hint">· zum Drehen ziehen</span></p>
    <div class="lb-stats wk-stats">
      <div><b>${W.cm ? String(W.cm).replace(".",",") + " cm" : "≈ 51 cm"}</b><span>Größe (Kopf bis Ferse)</span></div>
      <div><b>${W.g.toLocaleString("de-DE")} g</b><span>Gewicht${prev ? ` · ${W.g - prev.g >= 0 ? "+" : ""}${W.g - prev.g} g` : ""}</span></div>
      <div><b>${wk === nowWk ? Math.max(daysLeft, 0) : (40 - wk) * 7}</b><span>Tage bis Termin</span></div>
    </div>
    <div class="wk-card"><h3>Gewichtskurve</h3>${growthChart(wk)}<p class="wk-note">Durchschnittswerte – gesunde Babys sind unterschiedlich groß. Gewicht: WHO-Median${wk >= 41 ? " (ab SSW 41 Geburtsgewicht)" : ""}, Größe: NHS.</p></div>
    <div class="wk-card"><h3>👶 Das passiert beim Baby</h3><ul class="facts">${W.baby.map(([t, k]) => `<li>${esc(t)} ${srcChip(k)}</li>`).join("")}</ul></div>
    <div class="wk-card"><h3>🤰 Bei Lena</h3><ul class="facts">${W.mama.map(([t, k]) => `<li>${esc(t)} ${srcChip(k)}</li>`).join("")}</ul></div>
    ${DAILY[Math.min(Math.max(wk,30),41)] ? `<div class="wk-card"><h3>🧔 Für Hannes diese Woche</h3><ul class="facts">${DAILY[Math.min(Math.max(wk,30),41)].v.slice(0,3).map(t => `<li>${esc(t[1])} ${t[2] ? srcChip(t[2]) : ""}</li>`).join("")}</ul></div>` : ""}
    <details class="wk-src"><summary>Quellen (${used.length})</summary><ul>${used.map(k => `<li>${srcLink(k)}</li>`).join("")}</ul></details>
    <p class="lb-foot">Allgemeine Informationen, keine medizinische Beratung. Fragen immer mit Hebamme oder Ärztin klären.</p>`;
  mount3D(W.model);
}
async function mount3D(model){
  fruitScene?.dispose(); fruitScene = null;
  const stage = document.getElementById("fruitStage");
  try{
    const mod = await import("./fruit3d.js");
    if(!document.getElementById("fruitStage") || weekShown === null) return;
    // kurz das Bild zeigen, dann animiert ins drehbare 3D-Modell wechseln
    await new Promise(r => setTimeout(r, 550));
    if(!stage.isConnected) return;
    fruitScene = mod.mountFruit(stage, model, {intro:true, onReady:() => stage.classList.add("live")});
  }catch(e){ console.warn("3D nicht verfügbar", e); }   // Emoji bleibt als Ersatz stehen
}
function openWeek(wk){
  weekShown = Math.min(Math.max(wk, 28), 42);
  const el = document.getElementById("weekView"); el.hidden = false; document.body.classList.add("noscroll");
  renderWeek(); document.getElementById("weekClose").focus();
}
function closeWeek(){
  weekShown = null; fruitScene?.dispose(); fruitScene = null;
  document.getElementById("weekView").hidden = true; document.body.classList.remove("noscroll");
}
document.getElementById("weekView").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  if(b.id === "weekClose") closeWeek();
  if(b.dataset.wk){ weekShown = +b.dataset.wk; renderWeek(); }
});
document.addEventListener("keydown", e => { if(e.key === "Escape" && weekShown !== null) closeWeek(); });
// Wischen links/rechts blättert durch die Wochen (nicht auf der 3D-Bühne)
(() => { let sx = null, sy = 0; const el = document.getElementById("weekView");
  el.addEventListener("touchstart", e => { if(e.target.closest("#fruitStage")) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, {passive:true});
  el.addEventListener("touchend", e => { if(sx === null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if(Math.abs(dx) > 70 && Math.abs(dy) < 50){ const n = weekShown + (dx < 0 ? 1 : -1); if(n >= 28 && n <= 42){ weekShown = n; renderWeek(); } } }, {passive:true}); })();
