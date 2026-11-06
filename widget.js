/* ===== widget.js – Widget für Start- und Sperrbildschirm über die Gratis-App „Scriptable“ =====
   Die App erzeugt ein fertiges Skript mit euren Zugangsdaten (nur lesend, über das geheime Kalender-Token). */

function widgetScript(){
  const tok = cache.content?.calendar?.data?.token, app = location.origin + location.pathname.replace(/[^/]*$/, "");
  if(!tok || !CONFIGURED) return "";
  const et = `${ET.getFullYear()}-${String(ET.getMonth()+1).padStart(2,"0")}-${String(ET.getDate()).padStart(2,"0")}`;
  return `// Baby-Cockpit Widget für Scriptable – Startbildschirm (klein/mittel) und Sperrbildschirm
// Erzeugt von der Baby-Cockpit-App. Liest nur: SSW, nächste Fristen, Baby-Daten.
const CFG = ${JSON.stringify({url:CFG.url.replace(/\/$/, ""), key:CFG.key, token:tok, app, et})};

const fm = FileManager.local(), cachePath = fm.joinPath(fm.documentsDirectory(), "babycockpit.json");
let data = null;
try {
  const r = new Request(CFG.url + "/rest/v1/rpc/widget_data");
  r.method = "POST"; r.timeoutInterval = 10;
  r.headers = { apikey: CFG.key, Authorization: "Bearer " + CFG.key, "Content-Type": "application/json" };
  r.body = JSON.stringify({ p_token: CFG.token });
  data = await r.loadJSON();
  if (data) fm.writeString(cachePath, JSON.stringify(data));
} catch (e) {}
if (!data && fm.fileExists(cachePath)) data = JSON.parse(fm.readString(cachePath));
data = data || { tasks: [] };

const DAY = 864e5, today = new Date(); today.setHours(0, 0, 0, 0);
const et = new Date(CFG.et + "T00:00:00"), lmp = new Date(et.getTime() - 280 * DAY);
const gd = Math.round((today - lmp) / DAY), ssw = Math.floor(gd / 7) + "+" + (gd % 7), left = Math.max(0, Math.round((et - today) / DAY));
const baby = data.baby && data.baby.born ? data.baby : null;
const ageDays = baby ? Math.max(0, Math.floor((today - new Date(baby.born.slice(0, 10) + "T00:00:00")) / DAY)) : 0;
const big = baby ? (baby.name || "Baby") : ssw, sub = baby ? (ageDays === 0 ? "heute geboren" : ageDays + (ageDays === 1 ? " Tag alt" : " Tage alt")) : "noch " + left + " Tage";
const dd = iso => { const d = new Date(iso + "T00:00:00"), n = Math.round((d - today) / DAY);
  return n === 0 ? "heute" : n === 1 ? "morgen" : n < 0 ? "überfällig" : iso.slice(8, 10) + "." + iso.slice(5, 7) + "."; };
const tasks = (data.tasks || []).slice(0, 3);
const fam = config.widgetFamily || "medium";
const ink = new Color("#3A1022"), soft = new Color("#3A1022", .7);

const w = new ListWidget();
w.url = CFG.app; w.refreshAfterDate = new Date(Date.now() + 30 * 60e3);

if (fam === "accessoryInline") {
  w.addText(baby ? big + " · " + sub : "SSW " + ssw + " · noch " + left + " Tage");
} else if (fam === "accessoryCircular") {
  const s = w.addStack(); s.layoutVertically(); s.centerAlignContent();
  const a = s.addText(baby ? String(ageDays) : ssw); a.font = Font.boldSystemFont(baby ? 18 : 14); a.centerAlignText();
  const b = s.addText(baby ? "Tage" : "SSW"); b.font = Font.systemFont(10); b.centerAlignText();
} else if (fam === "accessoryRectangular") {
  const a = w.addText(baby ? big + " · " + sub : "SSW " + ssw + " · " + left + " Tage"); a.font = Font.boldSystemFont(14);
  for (const t of tasks.slice(0, 2)) { const l = w.addText(dd(t.sort) + ": " + t.title); l.font = Font.systemFont(12); l.lineLimit = 1; }
} else {
  const g = new LinearGradient(); g.colors = [new Color("#F7C2D6"), new Color("#F2A7C3")]; g.locations = [0, 1];
  w.backgroundGradient = g; w.setPadding(14, 14, 14, 14);
  const row = w.addStack(); row.layoutHorizontally();
  const col = row.addStack(); col.layoutVertically();
  const l1 = col.addText(baby ? "Unser Baby" : "Schwangerschaftswoche"); l1.font = Font.mediumSystemFont(11); l1.textColor = soft;
  const l2 = col.addText(big); l2.font = Font.boldRoundedSystemFont(fam === "small" ? 30 : 34); l2.textColor = ink; l2.minimumScaleFactor = .6;
  const l3 = col.addText(sub); l3.font = Font.mediumSystemFont(12); l3.textColor = soft;
  row.addSpacer();
  try {
    const img = await new Request(CFG.app + (baby ? "img/baby.png" : "img/w" + Math.min(Math.max(Math.floor(gd / 7), 28), 40) + ".png")).loadImage();
    const im = row.addImage(img); im.imageSize = fam === "small" ? new Size(44, 44) : new Size(58, 58);
  } catch (e) {}
  w.addSpacer();
  const list = fam === "small" ? tasks.slice(0, 1) : tasks;
  for (const t of list) {
    const s = w.addStack(); s.centerAlignContent();
    const d = s.addText(dd(t.sort)); d.font = Font.boldSystemFont(11); d.textColor = t.critical ? new Color("#B4235A") : ink;
    s.addSpacer(6);
    const x = s.addText(t.title); x.font = Font.systemFont(11); x.textColor = ink; x.lineLimit = 1;
    w.addSpacer(2);
  }
  if (!list.length) { const n = w.addText("Keine offenen Fristen 🤍"); n.font = Font.systemFont(11); n.textColor = soft; }
}
if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium();
Script.complete();
`;
}

function renderWidget(){
  const el = document.getElementById("widgetBox"); if(!el) return;
  const s = widgetScript();
  el.innerHTML = s ? `
    <p>Zeigt SSW, Tage bis zum Termin und die nächsten Fristen auf dem Start- oder Sperrbildschirm – nach der Geburt den Namen und das Alter.</p>
    <ol class="steps">
      <li>App <b>Scriptable</b> aus dem App Store laden (gratis).</li>
      <li>Hier <b>„Widget-Skript kopieren“</b> tippen.</li>
      <li>In Scriptable oben rechts <b>+</b> → einfügen → oben Namen „Baby-Cockpit“ geben → <b>Fertig</b>.</li>
      <li>Startbildschirm lange drücken → <b>Bearbeiten → Widget hinzufügen → Scriptable</b> (klein oder mittel) → Widget antippen → Script „Baby-Cockpit“ wählen.</li>
      <li>Sperrbildschirm: lange drücken → <b>Anpassen → Sperrbildschirm → Widgets → Scriptable</b> → ebenso das Script wählen.</li>
    </ol>
    <div class="set-row"><button class="btn" id="widgetCopy">Widget-Skript kopieren</button></div>`
    : `<p>Das Widget braucht das Kalender-Token aus dem Supabase-Setup (Schritt „Kalender“).</p>`;
}
document.addEventListener("click", async e => {
  if(e.target.id !== "widgetCopy") return;
  try{ await navigator.clipboard.writeText(widgetScript()); e.target.textContent = "Kopiert ✓"; }
  catch(err){ openSheet(`<h3 id="sheetTitle">Skript kopieren</h3><p>Text markieren und kopieren:</p><textarea readonly style="width:100%;height:240px;font:12px monospace">${esc(widgetScript())}</textarea>`); }
});
