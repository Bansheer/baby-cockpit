/* ===== docs.js – Dokumente: Mutterpass, Befunde, Anträge … im privaten Supabase-Speicher =====
   Dateien: Storage-Bucket "dokumente" (nur angemeldet). Liste: Sammlung "dokumente" ({title, cat, path, mime, size, added}).
   „Offline speichern“ legt eine Kopie im Gerät ab (Cache), z. B. den Mutterpass für den Kreißsaal. */

const DOC_CATS = [["schwanger","Schwangerschaft & Mutterpass","🤰"],["befunde","Befunde","🩺"],["aemter","Ämter & Anträge","🏛"],["arbeit","Arbeit & INPS","💼"],["baby","Baby","👶"],["sonst","Sonstiges","📎"]];
const DOC_CACHE = "bc-docs-v1";
let docFilter = "alle", docOffline = new Set(), docThumbs = {}, docView = null;
state.dokumente = state.dokumente || [];

const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
const catOf = k => DOC_CATS.find(c => c[0] === k) || DOC_CATS[5];
async function refreshOffline(){ try{ const c = await caches.open(DOC_CACHE); docOffline = new Set((await c.keys()).map(r => new URL(r.url).pathname.split("/").pop())); }catch(e){} }

/* ---------- Liste (oben in „Wissen“) ---------- */
async function renderDocs(){
  const el = document.getElementById("docBox"); if(!el) return;
  await refreshOffline();
  const list = [...state.dokumente].sort((a, b) => (b.added || "").localeCompare(a.added || ""));
  const shown = docFilter === "alle" ? list : list.filter(d => d.cat === docFilter);
  el.innerHTML = `
    <div class="doc-head"><h2>Dokumente <span class="count">${list.length || ""}</span></h2><button class="icon-btn" id="docAdd" aria-label="Dokument hinzufügen">+</button></div>
    <div class="chips doc-chips">${[["alle","Alle"], ...DOC_CATS.map(c => [c[0], c[1].split(" &")[0]])].map(([k, n]) => `<button class="chip" data-docf="${k}" aria-pressed="${docFilter===k}">${esc(n)}</button>`).join("")}</div>
    ${shown.length ? `<div class="doc-grid">${shown.map(d => `
      <button class="doc-card" data-doc="${esc(d.id)}">
        <span class="doc-thumb" data-thumb="${esc(d.id)}">${(d.mime||"").startsWith("image/") && docThumbs[d.id] ? `<img src="${docThumbs[d.id]}" alt="">` : `<span class="doc-ico">${(d.mime||"").includes("pdf") ? "📄" : catOf(d.cat)[2]}</span>`}</span>
        <b>${esc(d.title)}</b><small>${esc(catOf(d.cat)[1].split(" &")[0])}${docOffline.has(d.id) ? " · 📥 offline" : ""}</small>
      </button>`).join("")}</div>`
      : `<div class="empty doc-empty">Noch keine Dokumente${docFilter !== "alle" ? " in dieser Kategorie" : ""}. Tipp auf + und fotografiere z. B. den Mutterpass oder lade ein PDF hoch.</div>`}`;
  loadThumbs(shown.filter(d => (d.mime||"").startsWith("image/") && !docThumbs[d.id]));
}
async function loadThumbs(items){
  if(!items.length || !sb) return;
  for(const d of items){
    try{
      const c = await caches.open(DOC_CACHE), hit = await c.match(`doc/${d.id}`);
      if(hit){ docThumbs[d.id] = URL.createObjectURL(await hit.blob()); }
      else { const {data} = await sb.storage.from("dokumente").createSignedUrl(d.path, 3600); if(data?.signedUrl) docThumbs[d.id] = data.signedUrl; }
      const t = document.querySelector(`[data-thumb="${CSS.escape(d.id)}"]`); if(t && docThumbs[d.id]) t.innerHTML = `<img src="${docThumbs[d.id]}" alt="">`;
    }catch(e){}
  }
}

/* ---------- Hochladen ---------- */
function docAddSheet(){
  openSheet(`<h3 id="sheetTitle">Dokument hinzufügen</h3>
    <div class="field"><label for="docFile">Foto, Scan oder PDF</label><input type="file" id="docFile" accept="image/*,application/pdf"></div>
    <div class="field"><label for="docTitle">Name</label><input type="text" id="docTitle" placeholder="z. B. Mutterpass Seite 1"></div>
    <div class="field"><label for="docCat">Kategorie</label><select id="docCat">${DOC_CATS.map(c => `<option value="${c[0]}" ${docFilter===c[0]?"selected":""}>${c[1]}</option>`).join("")}</select></div>
    <label class="switch-row"><input type="checkbox" id="docOff"> Gleich offline auf diesem Gerät speichern</label>
    <button class="btn" id="docUpload" style="margin-top:14px">Hochladen</button><p class="lb-foot" id="docMsg">Tipp: Beim iPhone „Dokumente scannen“ in der Dateien-App ergibt saubere PDFs. Fotos werden automatisch verkleinert.</p>`);
}
async function shrinkImage(file){
  if(!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try{
    const bmp = await createImageBitmap(file), max = 2200, k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if(k === 1 && file.size < 1.5e6) return file;
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", .82));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {type:"image/jpeg"}) : file;
  }catch(e){ return file; }
}
async function docUpload(){
  const msg = document.getElementById("docMsg"), f = document.getElementById("docFile").files[0];
  if(!f){ msg.textContent = "Bitte zuerst eine Datei auswählen."; return; }
  if(!navigator.onLine){ msg.textContent = "Zum Hochladen braucht es Internet."; return; }
  const btn = document.getElementById("docUpload"); btn.disabled = true; msg.textContent = "Lade hoch …";
  try{
    const file = await shrinkImage(f), cat = document.getElementById("docCat").value;
    const title = document.getElementById("docTitle").value.trim() || f.name.replace(/\.\w+$/, "");
    const id = newId(), ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${cat}/${id}.${ext}`;
    const {error} = await sb.storage.from("dokumente").upload(path, file, {contentType:file.type || "application/octet-stream", upsert:false});
    if(error) throw error;
    await db.doc(`dokumente/${id}`).set({title, cat, path, mime:file.type, size:file.size, added:new Date().toISOString()});
    if(document.getElementById("docOff").checked){ const c = await caches.open(DOC_CACHE); await c.put(`doc/${id}`, new Response(file, {headers:{"Content-Type":file.type}})); }
    closeSheet(); renderDocs();
  }catch(e){ msg.textContent = "Fehler beim Hochladen: " + (e.message || e) + " – ist das SQL-Update 1.6 eingespielt?"; btn.disabled = false; }
}

/* ---------- Ansehen ---------- */
async function docBlob(d){
  const c = await caches.open(DOC_CACHE), hit = await c.match(`doc/${d.id}`);
  if(hit) return hit.blob();
  const {data, error} = await sb.storage.from("dokumente").download(d.path);
  if(error) throw error; return data;
}
async function openDoc(id){
  const d = state.dokumente.find(x => x.id === id); if(!d) return;
  const el = document.getElementById("docView"); el.hidden = false; document.body.classList.add("noscroll");
  el.innerHTML = `<div class="lb-head"><h2 id="docViewTitle">${esc(d.title)}</h2><button class="icon-btn" id="docClose" aria-label="Schließen">✕</button></div><p class="lb-foot">Lade …</p>`;
  try{
    const blob = await docBlob(d); if(docView) URL.revokeObjectURL(docView); docView = URL.createObjectURL(blob);
    const isImg = (d.mime || blob.type).startsWith("image/"), off = docOffline.has(d.id);
    el.innerHTML = `
      <div class="lb-head"><h2 id="docViewTitle">${esc(d.title)}</h2><button class="icon-btn" id="docClose" aria-label="Schließen">✕</button></div>
      <p class="doc-meta">${esc(catOf(d.cat)[1])} · ${fmtSize(d.size || blob.size)} · ${d.added ? esc(stamp(d.added)) : ""}${d._by ? " · " + esc(d._by) : ""}</p>
      ${isImg ? `<img class="doc-img" src="${docView}" alt="${esc(d.title)}">` : `<div class="doc-pdf"><span>📄</span><a class="btn" href="${docView}" target="_blank" rel="noopener">PDF öffnen</a></div>`}
      <div class="set-row doc-actions">
        <button class="btn sec" data-docact="offline" data-id="${esc(d.id)}">${off ? "📥 Offline entfernen" : "📥 Offline speichern"}</button>
        <button class="btn sec" data-docact="share" data-id="${esc(d.id)}">Teilen</button>
        <button class="btn sec" data-docact="edit" data-id="${esc(d.id)}">Umbenennen</button>
        <button class="btn danger" data-docact="del" data-id="${esc(d.id)}">Löschen</button></div>`;
  }catch(e){ el.querySelector(".lb-foot").textContent = navigator.onLine ? "Konnte nicht geladen werden." : "Offline – dieses Dokument ist nicht auf dem Gerät gespeichert."; }
}
function closeDoc(){ document.getElementById("docView").hidden = true; if(document.getElementById("weekView").hidden && document.getElementById("labor").hidden) document.body.classList.remove("noscroll"); }

async function docAction(act, id){
  const d = state.dokumente.find(x => x.id === id); if(!d) return;
  const c = await caches.open(DOC_CACHE);
  if(act === "offline"){
    if(docOffline.has(id)) await c.delete(`doc/${id}`); else await c.put(`doc/${id}`, new Response(await docBlob(d), {headers:{"Content-Type":d.mime || ""}}));
    await refreshOffline(); openDoc(id); renderDocs();
  }
  if(act === "share"){
    try{ const blob = await docBlob(d), ext = d.path.split(".").pop(), file = new File([blob], `${d.title}.${ext}`, {type:d.mime || blob.type});
      if(navigator.canShare?.({files:[file]})) await navigator.share({files:[file], title:d.title}); else window.open(docView, "_blank"); }catch(e){}
  }
  if(act === "edit"){
    openSheet(`<h3 id="sheetTitle">Dokument bearbeiten</h3>
      <div class="field"><label for="docETitle">Name</label><input type="text" id="docETitle" value="${esc(d.title)}"></div>
      <div class="field"><label for="docECat">Kategorie</label><select id="docECat">${DOC_CATS.map(cc => `<option value="${cc[0]}" ${d.cat===cc[0]?"selected":""}>${cc[1]}</option>`).join("")}</select></div>
      <button class="btn" id="docESave" data-id="${esc(id)}">Speichern</button>`);
  }
  if(act === "del" && confirm(`„${d.title}“ endgültig löschen?`)){
    try{ await sb.storage.from("dokumente").remove([d.path]); }catch(e){}
    await c.delete(`doc/${id}`); await db.doc(`dokumente/${id}`).delete(); closeDoc();
  }
}

document.addEventListener("click", e => {
  const t = e.target.closest("button, [data-doc]"); if(!t) return;
  if(t.id === "docAdd") return docAddSheet();
  if(t.id === "docUpload") return docUpload();
  if(t.id === "docClose") return closeDoc();
  if(t.id === "docESave"){ db.doc(`dokumente/${t.dataset.id}`).update({title:document.getElementById("docETitle").value.trim(), cat:document.getElementById("docECat").value}); closeSheet(); setTimeout(() => openDoc(t.dataset.id), 200); return; }
  if(t.dataset.docf){ docFilter = t.dataset.docf; return renderDocs(); }
  if(t.dataset.docact) return docAction(t.dataset.docact, t.dataset.id);
  if(t.dataset.doc) return openDoc(t.dataset.doc);
});
document.addEventListener("change", e => { if(e.target.id === "docFile"){ const f = e.target.files[0], t = document.getElementById("docTitle"); if(f && t && !t.value) t.value = f.name.replace(/\.\w+$/, ""); } });
document.addEventListener("keydown", e => { if(e.key === "Escape" && !document.getElementById("docView").hidden) closeDoc(); });
