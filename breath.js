/* ===== breath.js – geführte Atemübungen nach Gefühlslage =====
   Auswahl → Anleitung mit atmendem Kreis, optional Ton und Sprachansage. Übungen + Quellen in content.js (BREATH). */

const bs = { ex:null, phase:0, t0:0, total:0, start:0, raf:0, paused:false, pauseAt:0, sound:false, voice:false, inStart:false, lock:null, actx:null };

/* ---------- Auswahl ---------- */
function renderBreathPick(){
  const el = document.getElementById("breathView");
  el.innerHTML = `
    <div class="lb-head"><h2 id="breathTitle">Wie geht es dir gerade?</h2><button class="icon-btn" id="brClose" aria-label="Schließen">✕</button></div>
    <div class="br-grid">${BREATH.map(b => `<button class="br-card" data-brpick="${b.id}"><span class="br-ico" aria-hidden="true">${b.icon}</span><b>${esc(b.title)}</b><small>${esc(b.sub)}</small></button>`).join("")}</div>
    <p class="lb-foot">Wird dir schwindelig oder kribbelt es, einfach normal weiteratmen. Die Übungen kommen ohne langes Luftanhalten aus.</p>`;
}
function renderBreathIntro(ex){
  const el = document.getElementById("breathView");
  el.innerHTML = `
    <div class="lb-head"><button class="icon-btn ghost" id="brBack" aria-label="Zurück">‹</button><h2 id="breathTitle">${ex.icon} ${esc(ex.title)}</h2><button class="icon-btn" id="brClose" aria-label="Schließen">✕</button></div>
    <div class="wk-card"><h3>So geht's</h3><p>${esc(ex.how)}</p><h3>Warum</h3><p>${esc(ex.why)}</p>
      <p class="br-src">Quellen: ${ex.src.map(srcLink).join(" · ")}</p></div>
    <div class="br-opts">
      <label class="switch-row"><input type="checkbox" id="brSound" ${bs.sound?"checked":""}> Sanfter Ton beim Wechsel</label>
      <label class="switch-row"><input type="checkbox" id="brVoice" ${bs.voice?"checked":""}> Sprachansage („Einatmen“, „Ausatmen“)</label>
    </div>
    <button class="btn br-go" id="brStart">Starten</button>`;
}

/* ---------- Ablauf ---------- */
function renderBreathPlayer(){
  const ex = bs.ex, el = document.getElementById("breathView");
  el.innerHTML = `
    <div class="lb-head"><button class="icon-btn ghost" id="brBack" aria-label="Zurück">‹</button><h2 id="breathTitle">${ex.icon} ${esc(ex.title)}</h2><button class="icon-btn" id="brClose" aria-label="Schließen">✕</button></div>
    <div class="br-stage"><div class="br-halo"></div><div class="br-circle" id="brCircle"></div>
      <div class="br-label"><b id="brPhase" aria-live="polite">Bereit</b><span id="brCount"></span></div></div>
    <div class="br-progress"><span id="brBar"></span></div>
    <p class="br-time" id="brTime"></p>
    <div class="set-row br-ctrl">
      ${ex.labour ? `<button class="btn" id="brDone">Wehe vorbei</button>` : ""}
      <button class="btn sec" id="brPause">Pause</button><button class="btn sec" id="brStop">Beenden</button></div>`;
}
function tone(freq){
  if(!bs.sound) return;
  try{
    bs.actx = bs.actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = bs.actx.createOscillator(), g = bs.actx.createGain(), t = bs.actx.currentTime;
    o.type = "sine"; o.frequency.value = freq; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.08, t + .15); g.gain.exponentialRampToValueAtTime(.0001, t + 1.4);
    o.connect(g).connect(bs.actx.destination); o.start(t); o.stop(t + 1.5);
  }catch(e){}
}
function say(text){
  if(!bs.voice || !("speechSynthesis" in window)) return;
  try{ speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.replace(/ –.*/, "")); u.lang = "de-DE"; u.rate = .85; u.pitch = .95; speechSynthesis.speak(u); }catch(e){}
}
function curPhase(){ return bs.inStart ? bs.ex.start : bs.ex.phases[bs.phase]; }
function enterPhase(){
  const p = curPhase(); bs.t0 = performance.now();
  document.getElementById("brPhase").textContent = p[0];
  tone(p[3] > p[2] ? 432 : 324); say(p[0]);
}
function tick(now){
  if(bs.paused){ bs.raf = requestAnimationFrame(tick); return; }
  const p = curPhase(), dur = p[1] * 1000, k = Math.min((now - bs.t0) / dur, 1);
  const e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2) / 2;      // weich ein/aus
  const sc = p[2] + (p[3] - p[2]) * e;
  const c = document.getElementById("brCircle"); if(!c){ return; }
  c.style.transform = `scale(${sc.toFixed(3)})`;
  document.getElementById("brCount").textContent = Math.max(1, Math.ceil(p[1] - (now - bs.t0) / 1000));
  const el = (now - bs.start) / 1000;
  if(bs.total){ document.getElementById("brBar").style.width = Math.min(el / bs.total * 100, 100) + "%";
    const left = Math.max(0, Math.ceil(bs.total - el)); document.getElementById("brTime").textContent = `noch ${Math.floor(left/60)}:${String(left%60).padStart(2,"0")}`; }
  else document.getElementById("brTime").textContent = `${Math.floor(el/60)}:${String(Math.floor(el%60)).padStart(2,"0")}`;
  if(k >= 1){
    if(bs.inStart) bs.inStart = false; else bs.phase = (bs.phase + 1) % bs.ex.phases.length;
    if(bs.total && el >= bs.total && bs.phase === 0) return finishBreath();
    enterPhase();
  }
  bs.raf = requestAnimationFrame(tick);
}
async function startBreath(){
  bs.sound = document.getElementById("brSound")?.checked || false;
  bs.voice = document.getElementById("brVoice")?.checked || false;
  try{ localStorage.setItem("bc.breathOpts", JSON.stringify({sound:bs.sound, voice:bs.voice})); }catch(e){}
  bs.total = bs.ex.mins * 60; bs.phase = 0; bs.paused = false; bs.inStart = !!bs.ex.start;
  renderBreathPlayer(); bs.start = performance.now(); enterPhase();
  cancelAnimationFrame(bs.raf); bs.raf = requestAnimationFrame(tick);
  try{ bs.lock = await navigator.wakeLock?.request("screen"); }catch(e){}
}
function stopBreath(){ cancelAnimationFrame(bs.raf); try{ speechSynthesis.cancel(); }catch(e){} try{ bs.lock?.release(); }catch(e){} bs.lock = null; }
function finishBreath(){
  stopBreath();
  const el = document.getElementById("breathView");
  el.innerHTML = `<div class="lb-head"><h2 id="breathTitle">Gut gemacht 🤍</h2><button class="icon-btn" id="brClose" aria-label="Schließen">✕</button></div>
    <p class="br-end">${bs.ex.labour ? "Zwischen den Wehen: Schultern sinken lassen, trinken, ausruhen." : "Spür kurz nach, wie es dir jetzt geht."}</p>
    <div class="set-row">${bs.ex.labour ? `<button class="btn" data-brpick="wehe">Nächste Wehe</button>` : `<button class="btn" id="brAgain">Noch einmal</button>`}<button class="btn sec" id="brMore">Andere Übung</button></div>`;
}
function openBreath(id){
  try{ const o = JSON.parse(localStorage.getItem("bc.breathOpts") || "{}"); bs.sound = !!o.sound; bs.voice = !!o.voice; }catch(e){}
  const el = document.getElementById("breathView"); el.hidden = false; document.body.classList.add("noscroll");
  const ex = BREATH.find(b => b.id === id);
  if(ex){ bs.ex = ex; if(ex.labour) startBreath(); else renderBreathIntro(ex); } else renderBreathPick();
  el.querySelector("#brClose")?.focus();
}
function closeBreath(){ stopBreath(); document.getElementById("breathView").hidden = true; if(document.getElementById("labor").hidden && document.getElementById("weekView").hidden) document.body.classList.remove("noscroll"); }

document.addEventListener("click", e => { const b = e.target.closest("[data-breath]"); if(b && !e.target.closest("#breathView")) openBreath(b.dataset.breath); });
document.getElementById("breathView").addEventListener("click", e => {
  const b = e.target.closest("button"); if(!b) return;
  if(b.id === "brClose") return closeBreath();
  if(b.id === "brBack"){ stopBreath(); return renderBreathPick(); }
  if(b.dataset.brpick){ bs.ex = BREATH.find(x => x.id === b.dataset.brpick); return bs.ex.labour ? startBreath() : renderBreathIntro(bs.ex); }
  if(b.id === "brStart" || b.id === "brAgain") return startBreath();
  if(b.id === "brMore"){ stopBreath(); return renderBreathPick(); }
  if(b.id === "brStop" || b.id === "brDone") return finishBreath();
  if(b.id === "brPause"){ bs.paused = !bs.paused; b.textContent = bs.paused ? "Weiter" : "Pause";
    if(bs.paused) bs.pauseAt = performance.now(); else { const d = performance.now() - bs.pauseAt; bs.t0 += d; bs.start += d; } }
});
document.addEventListener("keydown", e => { if(e.key === "Escape" && !document.getElementById("breathView").hidden) closeBreath(); });
