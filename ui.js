/* ===== ui.js – Design-Layer v1.4: Hell/Dunkel, Begrüßung, Wochenleiste, Kacheln, Fruchtbild ===== */

/* ---------- Hell / Dunkel / System ---------- */
const THEME_KEY = "bc.theme";
const sysDark = matchMedia("(prefers-color-scheme: dark)");
function themePref(){ try{ return localStorage.getItem(THEME_KEY) || "system"; }catch(e){ return "system"; } }
function applyTheme(){
  const p = themePref(), dark = p === "dark" || (p === "system" && sysDark.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#141015" : "#FBF4F6");
  const tg = document.getElementById("themeTg");
  if(tg){ tg.setAttribute("aria-label", dark ? "Helles Design" : "Dunkles Design"); tg.innerHTML = dark
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>`; }
  document.querySelectorAll("[data-theme-set]").forEach(b => b.setAttribute("aria-pressed", b.dataset.themeSet === p));
}
function setTheme(p){ try{ localStorage.setItem(THEME_KEY, p); }catch(e){} applyTheme(); }
sysDark.addEventListener?.("change", applyTheme);
document.addEventListener("click", e => {
  if(e.target.closest("#themeTg")){ setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"); return; }
  const t = e.target.closest("[data-theme-set]"); if(t) setTheme(t.dataset.themeSet);
});

/* ---------- Begrüßung ---------- */
function renderGreet(){
  const me = (typeof LS !== "undefined" && LS.get("bc.me", "")) || "";
  const n = document.getElementById("greetName"), a = document.getElementById("greetAva"), d = document.getElementById("greetDate");
  if(!n) return;
  n.textContent = me ? `Hallo, ${me}` : "Hallo";
  a.innerHTML = `<img src="img/${me === "Hannes" ? "ava-hannes" : "ava-lena"}.png" alt="">`;
  d.textContent = new Date().toLocaleDateString("de-DE", {weekday:"long", day:"numeric", month:"long"});
}

/* ---------- Fruchtbild im Hero ---------- */
const weekImg = w => `img/w${Math.min(Math.max(w, 28), 40)}.png`;
function renderHeroImage(){
  const img = document.getElementById("heroFruit"); if(!img) return;
  const born = state.baby && state.baby.born;
  const w = Math.floor((today() - LMP) / 864e5 / 7);
  const src = born ? "img/baby.png" : weekImg(w);
  if(img.getAttribute("src") !== src) img.setAttribute("src", src);
}

/* ---------- Wochenleiste (Mo–So) mit Terminpunkten ---------- */
function isoOf(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function renderDayStrip(){
  const el = document.getElementById("dayStrip"); if(!el) return;
  const t = today(), mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  const names = ["Mo","Di","Mi","Do","Fr","Sa","So"];
  el.innerHTML = names.map((n, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i); const iso = isoOf(d);
    const has = state.tasks.some(x => x.sort === iso && x.status !== "Erledigt");
    const on = iso === isoOf(t);
    return `<button class="day ${on ? "on" : ""} ${has ? "dot" : ""}" data-day="${iso}" aria-label="${d.toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"})}${has ? ", Termine" : ""}"><i></i><span>${n}</span><b>${d.getDate()}</b></button>`;
  }).join("");
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-day]"); if(!b) return;
  const iso = b.dataset.day, list = state.tasks.filter(x => x.sort === iso);
  openSheet(`<h3 id="sheetTitle">${parse(iso).toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"})}</h3>
    ${list.length ? `<div class="list">${list.map(rowHTML).join("")}</div>` : `<p class="empty">An diesem Tag steht nichts an.</p>`}`);
});

/* ---------- Kachel Erstausstattung ---------- */
function renderShopTile(){
  const el = document.getElementById("shopTile"); if(!el) return;
  const s = shopStats(), pct = s.total ? Math.round(s.done / s.total * 100) : 0;
  el.innerHTML = `<span class="tag">Erstausstattung</span><b class="tile-big">${pct} %</b><span class="tile-bar"><span style="width:${pct}%"></span></span><small>${s.mustOpen} Muss-Punkte offen</small>`;
}

function renderUI(){ applyTheme(); renderGreet(); renderHeroImage(); renderDayStrip(); renderShopTile(); }
applyTheme();
