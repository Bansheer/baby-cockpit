/* ===== app.js – Oberfläche: Ansichten, Rendering, Eingaben ===== */
/* ===== Konstanten ===== */
const ET = new Date(2027,0,10);
const LMP = new Date(ET.getTime() - 280*864e5);
const STATUS = ["Offen","In Klärung","Geplant","Erledigt"];
const WHO = ["Lena","Hannes","Beide"];
const sKey = s => "s-" + s.replace("ä","ae").replace(/\s/g,"");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const today = () => { const d=new Date(); d.setHours(0,0,0,0); return d; };
const parse = iso => { if(!iso) return null; const [y,m,d]=iso.split("-").map(Number); return new Date(y,m-1,d); };
const dDiff = iso => { const d=parse(iso); return d ? Math.round((d-today())/864e5) : null; };
const SIZES = {28:["wie eine Aubergine",37,"1,0","🍆"],29:["wie ein Butternusskürbis",39,"1,2","🎃"],30:["wie ein Weißkohl",40,"1,3","🥬"],31:["wie eine Kokosnuss",41,"1,5","🥥"],32:["wie ein Chinakohl",42,"1,7","🥬"],33:["wie eine Ananas",44,"1,9","🍍"],34:["wie eine Cantaloupe-Melone",45,"2,1","🍈"],35:["wie eine Honigmelone",46,"2,4","🍈"],36:["wie ein Römersalat",47,"2,6","🥬"],37:["wie ein Bund Mangold",49,"2,9","🥬"],38:["wie eine Lauchstange",50,"3,1","🥬"],39:["wie eine kleine Wassermelone",51,"3,3","🍉"],40:["wie ein Kürbis",51,"3,5","🎃"]};
const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

/* ===== Zustand ===== */
const state = { tasks:[], talk:[], questions:[], log:[], checks:{}, who:"Alle", showDone:false, view:"heute" };
let db = null, canWrite = true;

/* ===== Statisches Wissen ===== */
let WISSEN = []; // Inhalt kommt aus der Datenbank (content/wissen)

/* ===== Einkauf ===== */
const SHOP_CATS = [["herrichten","Herrichten & Vorbereiten"],["schlafen","Schlafen"],["wickeln","Wickeln"],["kleidung","Kleidung (Gr. 50/56 und 62)"],["baden","Baden & Pflege"],["gesund","Gesundheit & Hausapotheke"],["stillen","Stillen & Füttern"],["unterwegs","Unterwegs"],["haushalt","Haushalt & Wäsche"],["lena","Für Lena – Wochenbett zu Hause"],["spielen","Spielen & Beruhigen"]];
const SHOP = [["schlafen01", "schlafen", "Beistellbett oder Babybett", "1", "M", "Beistellbett erleichtert nächtliches Stillen"], ["schlafen02", "schlafen", "Matratze, fest und passgenau", "1", "M", "Max. 2 Finger Spalt zum Rahmen; neu kaufen, nicht gebraucht"], ["schlafen03", "schlafen", "Wasserdichter Matratzenschoner", "2", "M", "Einer im Bett, einer in der Wäsche"], ["schlafen04", "schlafen", "Spannbettlaken babybay Maxi/Comfort Plus (89 × 50 cm)", "3", "M", "Original babybay Jersey Deluxe (Doppelpack + 1 einzeln) – Matratze hat abgerundete Ecken"], ["schlafen05", "schlafen", "Babyschlafsack Gr. 50/56, Winterstärke", "2", "M", "Statt Decke; Januar: TOG ca. 2,5"], ["schlafen06", "schlafen", "Babyschlafsack Gr. 62/68", "1", "S", "Für ab ca. 2–3 Monaten"], ["schlafen07", "schlafen", "Pucksack", "1", "O", "Manche Babys beruhigt es, andere nicht"], ["schlafen08", "schlafen", "Babyphone", "1", "S", "Mit Gegensprechen praktisch; Video optional"], ["schlafen09", "schlafen", "Nachtlicht, dimmbar und warmweiß", "1", "M", "Für nächtliches Stillen und Wickeln"], ["schlafen10", "schlafen", "Raumthermometer mit Luftfeuchte", "1", "S", "Schlafzimmer 16–20 °C (Lullaby Trust)"], ["schlafen11", "schlafen", "Verdunkelung fürs Schlafzimmer", "1", "O", ""], ["schlafen12", "schlafen", "Spieluhr oder White-Noise-Gerät", "1", "O", ""], ["schlafen13", "schlafen", "Stubenwagen oder Wiege fürs Wohnzimmer", "1", "O", "Tagsüber praktisch, alternativ Kinderwagenwanne"], ["schlafen14", "schlafen", "KEIN Kissen, Nestchen oder Bettdecke", "–", "M", "Wichtig für sicheren Babyschlaf – bewusst weglassen"], ["wickeln01", "wickeln", "Wickelkommode oder Wickelaufsatz", "1", "M", "Kommode vorhanden – Aufsatz/Rand gegen Herunterfallen"], ["wickeln02", "wickeln", "Wickelauflage, abwaschbar", "1", "M", ""], ["wickeln03", "wickeln", "Bezüge für die Wickelauflage", "2", "S", ""], ["wickeln04", "wickeln", "Wärmestrahler über dem Wickelplatz", "1", "S", "Im Januar sehr angenehm"], ["wickeln05", "wickeln", "Windeln Größe 1 (2–5 kg)", "2 Packungen", "M", "Nicht zu viele von einer Marke – erst testen"], ["wickeln06", "wickeln", "Windeln Newborn (bis 3 kg)", "1 Packung", "O", "Nur falls das Baby klein ist"], ["wickeln07", "wickeln", "Feuchttücher, parfümfrei oder 99 % Wasser", "4 Packungen", "M", "Anfangs genügen warmes Wasser und Waschlappen"], ["wickeln08", "wickeln", "Waschlappen oder Mulltücher für den Po", "10", "M", ""], ["wickeln09", "wickeln", "Wundschutzcreme mit Zink", "1", "M", ""], ["wickeln10", "wickeln", "Windeleimer mit Deckel + Beutel", "1", "S", "Geruchsdicht spart Wege zum Müll"], ["wickeln11", "wickeln", "Spucktücher / Mullwindeln", "10–15", "M", "Braucht man ständig"], ["wickeln12", "wickeln", "Wickelunterlage für unterwegs", "1", "S", ""], ["wickeln13", "wickeln", "Wattepads, groß", "1 Packung", "S", "Für Gesicht und Augen"], ["kleidung01", "kleidung", "Wickelbodys langarm Gr. 50/56", "6", "M", "Wickelbodys sind anfangs leichter anzuziehen"], ["kleidung02", "kleidung", "Bodys kurzarm Gr. 50/56", "4", "S", "Als Unterschicht"], ["kleidung03", "kleidung", "Bodys langarm Gr. 62", "6", "M", "Neugeborene wachsen schnell"], ["kleidung04", "kleidung", "Strampler Gr. 50/56", "6", "M", ""], ["kleidung05", "kleidung", "Strampler Gr. 62", "4", "S", ""], ["kleidung06", "kleidung", "Schlafanzüge / Einteiler mit Fuß", "3", "M", "Reißverschluss von unten erleichtert nächtliches Wickeln"], ["kleidung07", "kleidung", "Pumphosen", "4", "S", ""], ["kleidung08", "kleidung", "Oberteile / Shirts mit weitem Ausschnitt", "4", "S", ""], ["kleidung09", "kleidung", "Strickjacke / Wickeljacke", "2", "S", ""], ["kleidung10", "kleidung", "Söckchen", "6 Paar", "M", ""], ["kleidung11", "kleidung", "Mützchen dünn (Baumwolle)", "2", "M", ""], ["kleidung12", "kleidung", "Wintermütze mit Ohrenschutz", "1", "M", "Geburt im Januar"], ["kleidung13", "kleidung", "Kratzhandschuhe", "2 Paar", "O", ""], ["kleidung14", "kleidung", "Fleece- oder Walkoverall", "1", "M", "Für Kinderwagen; in der Babyschale nur dünne Kleidung"], ["kleidung15", "kleidung", "Halstücher / Lätzchen", "4", "O", "Erst später nötig"], ["kleidung16", "kleidung", "Heimfahrt-Outfit aus dem Krankenhaus", "1", "M", "Siehe Kliniktasche"], ["kleidung17", "kleidung", "Kleiderbügel klein + Aufbewahrungsboxen", "–", "O", ""], ["baden01", "baden", "Babybadewanne oder Badeeimer", "1", "M", ""], ["baden02", "baden", "Badewannenständer oder -sitz", "1", "O", "Schont den Rücken"], ["baden03", "baden", "Badethermometer", "1", "S", "Badewasser ca. 37 °C"], ["baden04", "baden", "Kapuzenhandtücher", "1–2 (1 vorhanden)", "M", ""], ["baden05", "baden", "Waschlappen weich", "5", "M", ""], ["baden06", "baden", "Mildes Babyöl oder Mandelöl", "1", "S", "Anfangs reicht klares Wasser"], ["baden07", "baden", "Badezusatz / Babyshampoo mild", "1", "O", "In den ersten Wochen nicht nötig"], ["baden08", "baden", "Babybürste mit weichen Borsten", "1", "O", ""], ["baden09", "baden", "Baby-Nagelschere mit runder Spitze", "1", "M", ""], ["baden10", "baden", "Baby-Nagelknipser oder Feile", "1", "S", "Viele finden Feilen anfangs sicherer"], ["baden11", "baden", "Wärmekissen / Kirschkernkissen", "1", "S", "Bei Bauchweh, vorher Temperatur testen"], ["baden12", "baden", "Babycreme für trockene Haut", "1", "O", ""], ["gesund01", "gesund", "Digitales Fieberthermometer (rektal)", "1", "M", "Rektal ist bei Säuglingen am genauesten"], ["gesund02", "gesund", "Nasensauger", "1", "M", "Manuell oder elektrisch; Schnupfen im Winter"], ["gesund03", "gesund", "Kochsalzlösung Ampullen 0,9 %", "1 Packung", "M", "Für Nase und Augenpflege"], ["gesund04", "gesund", "Vitamin-D-Tropfen", "1", "M", "Ab Tag 14 – Präparat von der Kinderärztin"], ["gesund05", "gesund", "Fiebermittel für Säuglinge", "1", "S", "Nur nach Rücksprache mit der Kinderärztin, Dosierung nach Gewicht"], ["gesund06", "gesund", "Bäuchleinöl / Kümmelöl", "1", "O", ""], ["gesund07", "gesund", "Erste-Hilfe-Set für Babys", "1", "S", "Pflaster, Kompressen, Pinzette"], ["gesund08", "gesund", "Notfallnummern am Kühlschrank", "1", "M", "Kinderärztin, Kreißsaal, Giftnotruf, 112"], ["stillen01", "stillen", "Stillkissen", "1", "M", "Auch in der Schwangerschaft zum Schlafen"], ["stillen02", "stillen", "Still-BHs", "3", "M", "Im 9. Monat anpassen lassen"], ["stillen03", "stillen", "Stilleinlagen (Einweg oder waschbar)", "2 Packungen", "M", ""], ["stillen04", "stillen", "Brustwarzensalbe (Lanolin)", "1", "M", ""], ["stillen05", "stillen", "Stilltops / Kleidung mit Stillfunktion", "3", "S", ""], ["stillen06", "stillen", "Milchauffangschalen", "1 Paar", "O", ""], ["stillen07", "stillen", "Stillhütchen", "–", "O", "Nur bei Bedarf nach Beratung"], ["stillen08", "stillen", "Milchpumpe", "–", "O", "Nicht vorab kaufen – bei Bedarf Apotheke mieten"], ["stillen09", "stillen", "Fläschchen + Sauger Größe 1", "2", "S", "Notreserve"], ["stillen10", "stillen", "Pre-Nahrung, kleine Packung (ungeöffnet)", "1", "S", "Notreserve"], ["stillen11", "stillen", "Flaschenbürste", "1", "S", ""], ["stillen12", "stillen", "Vaporisator / Sterilisator", "1", "O", "Auskochen geht auch"], ["stillen13", "stillen", "Bequemer Stillplatz mit Fußhocker", "1", "S", ""], ["stillen14", "stillen", "Große Wasserflasche mit Trinkhalm am Stillplatz", "1", "M", ""], ["stillen15", "stillen", "Snacks am Stillplatz", "–", "S", "Nüsse, Riegel"], ["unterwegs01", "unterwegs", "Kinderwagen mit Liegewanne", "1", "M", "Probefahren, Kofferraum messen"], ["unterwegs02", "unterwegs", "Babyschale (Isofix)", "1", "M", "Gekauft"], ["unterwegs03", "unterwegs", "Winterfußsack für Wanne/Babyschale", "1", "M", "Geburt im Januar"], ["unterwegs04", "unterwegs", "Regenschutz für den Kinderwagen", "1", "M", ""], ["unterwegs05", "unterwegs", "Wagendecke", "1", "S", ""], ["unterwegs06", "unterwegs", "Wickeltasche / Wickelrucksack", "1", "M", ""], ["unterwegs07", "unterwegs", "Tragetuch oder Babytrage ab Geburt", "1", "S", "Vorher Trageberatung"], ["unterwegs08", "unterwegs", "Rücksitzspiegel fürs Auto", "1", "O", ""], ["unterwegs09", "unterwegs", "Sonnenschutz fürs Autofenster", "1", "O", "Erst im Frühjahr wichtig"], ["unterwegs10", "unterwegs", "Thermosflasche für Wasser", "1", "O", ""], ["unterwegs11", "unterwegs", "Kinderwagenkette / Greifspielzeug", "1", "O", ""], ["spielen01", "spielen", "Schnuller Größe 0", "2", "S", "Erst wenn das Stillen gut läuft"], ["spielen02", "spielen", "Schnullerkette", "1", "O", ""], ["spielen03", "spielen", "Kuscheltuch / Schmusetuch", "1", "O", ""], ["spielen04", "spielen", "Krabbeldecke / Spielbogen", "1", "O", "Ab ca. 6–8 Wochen interessant"], ["spielen05", "spielen", "Mobile über dem Wickelplatz", "1", "O", ""], ["spielen06", "spielen", "Kontrastkarten schwarz-weiß", "1", "O", ""], ["haushalt01", "haushalt", "Feinwaschmittel ohne Duft- und Farbstoffe", "1", "M", "Kein Weichspüler"], ["haushalt02", "haushalt", "Gallseife / Fleckenmittel", "1", "M", "Gegen Milch- und Stuhlflecken"], ["haushalt03", "haushalt", "Wäschenetz für Söckchen", "2", "S", ""], ["haushalt04", "haushalt", "Zusätzlicher Wäscheständer", "1", "O", ""], ["haushalt05", "haushalt", "Vorrat Küchenrolle, Toilettenpapier, Müllbeutel", "–", "S", ""], ["haushalt06", "haushalt", "Rauchmelder im Kinderzimmer prüfen", "–", "S", ""], ["haushalt07", "haushalt", "Luftfilter im Kinderzimmer", "1", "S", "Vorhanden"], ["haushalt08", "haushalt", "Kühlakkus / Gefrierbeutel", "–", "O", "Für Kühlpads und Vorkochen"], ["lena01", "lena", "Wochenbett-Binden extra groß", "2 Packungen", "M", ""], ["lena02", "lena", "Einmal-Netzhosen oder Baumwollslips", "10", "M", ""], ["lena03", "lena", "Kühlpads für den Damm", "–", "S", "Hebamme fragen"], ["lena04", "lena", "Intimdusche / Spülflasche", "1", "S", "Erleichtert die ersten Toilettengänge"], ["lena05", "lena", "Sitzring", "1", "O", ""], ["lena06", "lena", "Bequeme Hosen mit weichem Bund", "3", "S", ""], ["lena07", "lena", "Bademantel / Hausschuhe", "1", "O", ""], ["lena08", "lena", "Wärmflasche", "1", "O", ""], ["herrichten01", "herrichten", "Babybett aufbauen, Matratze lüften", "–", "M", ""], ["herrichten02", "herrichten", "Kommode ausräumen, Babykleidung einsortieren", "–", "M", ""], ["herrichten03", "herrichten", "Babywäsche und Bettwäsche vorwaschen", "–", "M", "Mit Feinwaschmittel, 40 °C"], ["herrichten04", "herrichten", "Wickelplatz einrichten (alles griffbereit)", "–", "M", ""], ["herrichten05", "herrichten", "Stillplatz einrichten", "–", "S", ""], ["herrichten06", "herrichten", "Kinderwagen zusammenbauen und Probe fahren", "–", "M", ""], ["herrichten07", "herrichten", "Babyschale probemontieren", "–", "M", "Endgültig, während Lena im KH ist"], ["herrichten08", "herrichten", "Raumtemperatur Kinderzimmer prüfen (16–20 °C)", "–", "S", ""], ["herrichten09", "herrichten", "Essen vorkochen und einfrieren", "–", "S", "10–15 Portionen für die ersten Wochen"], ["herrichten10", "herrichten", "Einkaufsvorräte auffüllen", "–", "S", ""], ["herrichten11", "herrichten", "Kliniktasche packen", "–", "M", "Liste unter Wissen"], ["herrichten12", "herrichten", "Babybett vor Katzen schützen", "–", "O", "Tür zu oder Katzennetz"], ["herrichten13", "herrichten", "Geburtskarte / Nachricht vorbereiten", "–", "O", ""], ["wickeln14", "wickeln", "Feuchttücher-Wärmer", "1", "O", "Nische – angenehm im Winter, nicht nötig"], ["wickeln15", "wickeln", "Windelbeutel für unterwegs", "1 Rolle", "S", ""], ["baden13", "baden", "Sterile Kompressen für die Nabelpflege", "1 Packung", "O", "Nur wenn die Hebamme es empfiehlt"], ["gesund09", "gesund", "Luftbefeuchter bei trockener Heizungsluft", "1", "O", "Hilft bei verstopfter Nase im Winter"], ["gesund10", "gesund", "Babywaage", "–", "O", "Nicht kaufen – Hebamme wiegt; bei Bedarf leihen"], ["stillen16", "stillen", "Muttermilchbeutel", "1 Packung", "O", "Nur falls ihr abpumpt"], ["spielen07", "spielen", "Schnullerbox", "1", "O", ""], ["unterwegs12", "unterwegs", "Neugeboreneneinsatz der Babyschale prüfen", "–", "M", "Kopfstütze und Gurt aufs Neugeborene einstellen"], ["unterwegs13", "unterwegs", "Kinderwagen-Organizer", "1", "O", ""], ["haushalt09", "haushalt", "Handcreme (viel Händewaschen)", "1", "O", ""], ["herrichten14", "herrichten", "Wehen-App aufs Handy laden", "–", "O", "Hilft beim Zeitpunkt fürs Losfahren"]].map(([id,cat,name,qty,prio,tip]) => ({id,cat,name,qty,prio,tip}));
state.shop = {}; state.shopExtra = []; state.prio = "A"; state.hideDone = true;
function allShop(){ return SHOP.concat(state.shopExtra.map(x => ({id:"x_"+x.id, cat:x.cat||"herrichten", name:x.name, qty:x.qty||"", prio:x.prio||"S", tip:x.tip||"", extra:x.id}))); }
function shopStats(){ const all = allShop(); const st = id => state.shop[id] || "";
  const rel = all.filter(i => st(i.id) !== "skip"); const done = rel.filter(i => st(i.id) === "ok").length;
  const mustOpen = all.filter(i => i.prio==="M" && !st(i.id)).length; return {total: rel.length, done, mustOpen}; }
function renderShop(){
  const {total, done, mustOpen} = shopStats();
  document.getElementById("shopSum").textContent = `${done} von ${total} erledigt`;
  document.getElementById("shopMust").textContent = `${mustOpen} Muss-Punkte offen`;
  document.getElementById("shopBar").style.width = total ? (done/total*100).toFixed(1) + "%" : "0";
  const all = allShop();
  document.getElementById("shopList").innerHTML = SHOP_CATS.map(([c,label]) => {
    const inCat = all.filter(i => i.cat === c);
    const cd = inCat.filter(i => state.shop[i.id]).length;
    const vis = inCat.filter(i => (state.prio==="A" || i.prio===state.prio) && !(state.hideDone && state.shop[i.id]));
    if(!vis.length && state.hideDone && cd === inCat.length) return `<details class="acc"><summary><span>${esc(label)}</span><span class="meta">${miniMeta(cd, inCat.length)}</span></summary></details>`;
    if(!vis.length) return "";
    return `<details class="acc" data-shopcat="${c}" ${state.openCats?.has(c)?"open":""}><summary><span>${esc(label)}</span><span class="meta">${miniMeta(cd, inCat.length)}</span></summary><div class="acc-body">${vis.map(i => {
      const st = state.shop[i.id] || "";
      return `<div class="shop ${st}"><button class="st-btn ${st}" data-shop="${esc(i.id)}" aria-label="Status: ${st==="ok"?"erledigt":st==="skip"?"nicht nötig":"offen"}" ${canWrite?"":"disabled"}>${st==="ok"?"✓":st==="skip"?"–":""}</button>
        <div><div class="nm"><span class="prio ${i.prio}" title="${i.prio==="M"?"Muss":i.prio==="S"?"Sinnvoll":"Optional"}"></span>${esc(i.name)}</div>${i.tip?`<div class="tp">${esc(i.tip)}</div>`:""}</div>
        <div class="qty">${i.qty && i.qty !== "–" ? esc(i.qty) : ""}${i.extra?`<button class="x" data-delshop="${esc(i.extra)}" aria-label="Eintrag löschen">×</button>`:""}</div></div>`; }).join("")}</div></details>`;
  }).join("");
  renderHomeShop();
}
function renderHomeShop(){ renderHome(); }
state.openCats = new Set();
document.addEventListener("toggle", e => { const d = e.target; if(d.dataset && d.dataset.shopcat){ d.open ? state.openCats.add(d.dataset.shopcat) : state.openCats.delete(d.dataset.shopcat); } }, true);
document.getElementById("shopList").addEventListener("click", async e => {
  const b = e.target.closest("[data-shop]");
  if(b){ const id = b.dataset.shop; const cur = state.shop[id] || ""; const nxt = cur==="" ? "ok" : cur==="ok" ? "skip" : "";
    state.shop = {...state.shop, [id]: nxt}; renderShop(); await write("state/shop", {[id]: nxt}, true); return; }
  const d = e.target.closest("[data-delshop]");
  if(d && db && canWrite && confirm("Eigenen Eintrag löschen?")){ try{ await db.doc(`shopExtra/${d.dataset.delshop}`).delete(); }catch(err){ note("Löschen fehlgeschlagen."); } }
});
document.getElementById("prioChips").addEventListener("click", e => { const b = e.target.closest("[data-p]"); if(!b) return; state.prio = b.dataset.p; document.querySelectorAll("#prioChips button").forEach(c => c.setAttribute("aria-pressed", c===b)); renderShop(); });
document.getElementById("showDoneShop").addEventListener("change", e => { state.hideDone = !e.target.checked; renderShop(); });
document.getElementById("addShop").addEventListener("click", () => openSheet(`<h3 id="sheetTitle">Eigener Eintrag</h3>
  <div class="field"><label for="shName">Was?</label><input type="text" id="shName" placeholder="z. B. Spieluhr von Oma"></div>
  <div class="field"><label for="shCat">Kategorie</label><select id="shCat">${SHOP_CATS.map(([c,l])=>`<option value="${c}">${esc(l)}</option>`).join("")}</select></div>
  <div class="field"><label for="shQty">Menge</label><input type="text" id="shQty" placeholder="z. B. 2"></div>
  <div class="field"><label>Priorität</label><div class="seg" id="shPrio"><button data-v="M" aria-pressed="false">Muss</button><button data-v="S" aria-pressed="true">Sinnvoll</button><button data-v="O" aria-pressed="false">Optional</button></div></div>
  <button class="btn" id="createShop">Hinzufügen</button>`));
document.getElementById("sheet").addEventListener("click", async e => {
  const pb = e.target.closest("#shPrio button"); if(pb){ pb.parentElement.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed", x===pb)); }
  if(e.target.id === "createShop"){ const name = document.getElementById("shName").value.trim(); if(!name){ document.getElementById("shName").focus(); return; }
    if(!db || !canWrite){ note("Speichern ist hier nicht möglich."); return; }
    try{ await db.collection("shopExtra").add({name, cat: document.getElementById("shCat").value, qty: document.getElementById("shQty").value.trim(), prio: document.querySelector('#shPrio button[aria-pressed="true"]')?.dataset.v || "S"}); closeSheet(); }
    catch(err){ note("Anlegen fehlgeschlagen."); } }
});

/* ===== Navigation ===== */
function show(view){
  state.view = view;
  document.querySelectorAll("[data-panel]").forEach(p => p.classList.toggle("hidden", p.dataset.panel !== view));
  document.querySelectorAll(".nav button").forEach(b => { if(b.dataset.view===view) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current"); });
  document.body.dataset.view = view;
  renderRail();
  window.scrollTo({top:0});
}
document.querySelectorAll(".nav button").forEach(b => b.addEventListener("click", () => show(b.dataset.view)));
document.addEventListener("click", e => { const g = e.target.closest("[data-goto]"); if(g) show(g.dataset.goto); });

/* ===== Header & Zeitband ===== */
function artikel(f){ const fem = ["Aubergine","Kokosnuss","Ananas","Cantaloupe-Melone","Honigmelone","Lauchstange"]; return (fem.includes(f) ? "eine " : "ein ") + f; }
function renderHero(){
  document.getElementById("hcLabel").textContent = "Schwangerschaftswoche"; document.getElementById("hcBand").hidden = false;
  if(state.baby && state.baby.born && window.renderBornHero) return renderBornHero();
  const days = Math.round((ET - today())/864e5);
  const gd = Math.round((today() - LMP)/864e5);
  const w = Math.floor(gd/7), d = gd%7;
  document.getElementById("ssw").textContent = `${w}+${d}`;
  document.getElementById("sswSub").textContent = "Termin 10.01.2027";
  const pct = Math.min(Math.max(gd/280,0),1), R = 36, C = 2*Math.PI*R;
  document.getElementById("ring").innerHTML = `<svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="${R}" fill="none" stroke="var(--accent-soft)" stroke-width="7"/><circle cx="42" cy="42" r="${R}" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(C*pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 42 42)"/></svg><div class="rv">${Math.max(days,0)}<small>Tage</small></div>`;
  const sz = SIZES[Math.min(Math.max(w,28),40)], wk = (typeof WEEKS !== "undefined" ? WEEKS : {})[Math.min(Math.max(w,28),42)];
  document.getElementById("babySize").innerHTML = sz ? `<span class="fruit" aria-hidden="true">${sz[3]}</span><span><span class="fz-t">So groß wie ${esc(wk ? (/^(kleine|Bund)/.test(wk.fruit) ? "ein"+(wk.fruit.startsWith("kleine")?"e ":" ")+wk.fruit : artikel(wk.fruit)) : sz[0].replace(/^wie /,""))}</span><span class="fz-s">ca. ${wk && wk.cm ? String(wk.cm).replace(".",",") : sz[1]} cm · ${wk ? (wk.g/1000).toFixed(1).replace(".",",") : sz[2]} kg</span></span><span class="fz-more" aria-hidden="true">›</span>` : "";
  document.getElementById("babySize").dataset.week = Math.min(Math.max(w,28),42);
  const svg = document.getElementById("bandSvg");
  const W = Math.round(svg.getBoundingClientRect().width) || 400;
  svg.setAttribute("viewBox", `0 0 ${W} 74`);
  const A = 26, B = 42, x = wk => 12 + ((Math.min(Math.max(wk,A),B)-A)/(B-A))*(W-24);
  const marks = [[28,"Anti-D",0],[33.6,"PDA",1],[35,"Ultraschall",0],[37,"Ambulanz",1],[40,"Termin",0]];
  let s = `<rect x="${x(A)}" y="24" width="${x(B)-x(A)}" height="10" rx="5" fill="var(--accent-soft)"/>`;
  s += `<rect x="${x(A)}" y="24" width="${Math.max(x(gd/7)-x(A),0)}" height="10" rx="5" fill="var(--accent)"/>`;
  for(let wk=A; wk<=B; wk+=2){ s += `<text x="${x(wk)}" y="16" font-size="11" text-anchor="middle" fill="var(--muted)">${wk}</text>`; }
  marks.forEach(([wk,l,row]) => { const ly = row ? 68 : 54; const past = wk < gd/7; s += `<line x1="${x(wk)}" x2="${x(wk)}" y1="35" y2="${ly-10}" stroke="var(--line)" stroke-width="1"/><circle cx="${x(wk)}" cy="29" r="4" fill="${past?"var(--accent)":"var(--surface)"}" stroke="var(--accent)" stroke-width="1.5"/><text x="${x(wk)}" y="${ly}" font-size="12" text-anchor="middle" fill="var(--ink)">${l}</text>`; });
  s += `<circle cx="${x(gd/7)}" cy="29" r="7" fill="var(--accent)" stroke="var(--surface)" stroke-width="2.5"/>`;
  document.getElementById("bandSvg").innerHTML = s;
}

/* ===== Aufgaben ===== */
const open = t => t.status !== "Erledigt";
function urgency(t){ const dd = dDiff(t.sort); let u = 0;
  if(t.critical) u += 60; if(t.status === "In Klärung") u += 25; if(t.status === "Offen") u += 10;
  if(dd !== null){ if(dd < 0) u += 80; else u += Math.max(0, 30 - dd) * 2; }
  return u; }
function dueText(t){ const dd = dDiff(t.sort); if(!open(t) || dd === null || dd > 30) return "";
  if(dd < 0) return `<span class="due d-urgent">überfällig</span>`;
  if(dd === 0) return `<span class="due d-urgent">heute</span>`;
  if(dd <= 7) return `<span class="due d-urgent">in ${dd} ${dd===1?"Tag":"Tagen"}</span>`;
  if(dd <= 14) return `<span class="due d-soon">in ${dd} Tagen</span>`;
  return `<span class="due d-later">in ${dd} Tagen</span>`; }
function whenCls(t){ const dd = dDiff(t.sort); return (open(t) && dd !== null && dd <= 7 && dd >= -3) ? "when soon" : "when"; }
function rowHTML(t){
  return `<button class="row ${t.status==="Erledigt"?"done":""}" data-task="${esc(t.id)}">
    <div class="when">${esc(t.when)}${dueText(t)}</div>
    <div><div class="title">${esc(t.title)}</div><div class="who">${esc(t.who)}</div></div>
    <span class="pill ${sKey(t.status)}">${esc(t.status)}</span></button>`;
}
function sorted(list){ return [...list].sort((a,b) => (a.sort||"9999").localeCompare(b.sort||"9999")); }
function renderTasks(){
  const list = sorted(state.tasks).filter(t => (state.who==="Alle" || t.who===state.who || t.who==="Beide") && (state.showDone || open(t)));
  const el = document.getElementById("taskGroups");
  if(!state.tasks.length){ el.innerHTML = `<div class="empty">Noch keine Aufgaben gespeichert.</div>`; return; }
  const groups = {};
  list.forEach(t => { const d = parse(t.sort); const k = d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "Ohne Datum"; (groups[k] ||= []).push(t); });
  el.innerHTML = Object.entries(groups).map(([k,v]) => `<div class="month">${k}</div><div class="list">${v.map(rowHTML).join("")}</div>`).join("") || `<div class="empty">Nichts offen für diese Auswahl.</div>`;
}
function renderHome(){
  const openT = sorted(state.tasks.filter(open));
  const soon = openT.filter(t => { const dd = dDiff(t.sort); return t.critical || (dd !== null && dd <= 14); }).sort((a,b) => urgency(b) - urgency(a)).slice(0,6);
  document.getElementById("soonCount").textContent = soon.length ? soon.length : "";
  document.getElementById("soonList").innerHTML = soon.length ? soon.map(rowHTML).join("") : `<div class="empty">In den nächsten 14 Tagen steht nichts an.</div>`;
  const next = openT.find(t => (dDiff(t.sort) ?? -1) >= 0);
  const crit = openT.find(t => t.critical);
  const openQ = state.questions.filter(q => !q.done).length;
  const openTalk = state.talk.filter(t => !t.decided).length;
  const k = []; const sh = shopStats();
  k.push(`<button class="stat" data-goto="aufgaben"><div class="label">Nächster Termin</div><div class="value">${next ? esc(next.when) : "–"}</div><div class="hint">${next ? esc(next.title) : ""}</div></button>`);
  if(crit){ const dd = dDiff(crit.sort); k.push(`<button class="stat ${dd!==null&&dd<=14?"urgent":""}" data-task="${esc(crit.id)}"><div class="label">Kritische Frist</div><div class="value">${dd!==null? (dd>=0? "in "+dd+" Tagen":"überfällig") : esc(crit.when)}</div><div class="hint">${esc(crit.title)}</div></button>`); }
  else k.push(`<button class="stat" data-goto="aufgaben"><div class="label">Offene Aufgaben</div><div class="value">${openT.length}</div><div class="hint">${openT.filter(t=>t.status==="In Klärung").length} in Klärung</div></button>`);
  k.push(`<button class="stat" data-goto="besprechen"><div class="label">Zu besprechen</div><div class="value">${openTalk}</div><div class="hint">${openQ} ${openQ===1?"Frage":"Fragen"} an Lena offen</div></button>`);
  k.push(`<button class="stat" data-goto="einkauf"><div class="label">Erstausstattung</div><div class="value">${sh.total?Math.round(sh.done/sh.total*100):0} %</div><div class="hint">${sh.mustOpen} Muss-Punkte offen</div><div class="bar"><span style="width:${sh.total?(sh.done/sh.total*100).toFixed(1):0}%"></span></div></button>`);
  document.getElementById("kpis").innerHTML = k.join("");
  const badge = document.getElementById("talkBadge"); badge.textContent = openTalk; badge.classList.toggle("hidden", !openTalk);
  renderRail(openT);
}
function renderRail(openT){
  openT = openT || sorted(state.tasks.filter(open));
  const title = document.getElementById("railTitle");
  if(state.view === "heute"){
    title.textContent = "Zu besprechen";
    const tk = [...state.talk].filter(t=>!t.decided).sort((a,b)=>(a.order||0)-(b.order||0));
    document.getElementById("railList").innerHTML = (tk.map(t => `<div class="item" data-goto="besprechen">${esc(t.title)}</div>`).join("") || `<div class="empty">Alles besprochen.</div>`)
      + `<h2>Schnell anrufen</h2><a class="item call" href="tel:+390473264140"><div class="d">Kreißsaal Meran</div>0473 264 140</a><a class="item call" href="tel:+390471100100"><div class="d">Termine buchen (ELVS)</div>0471 100 100</a>`;
    return;
  }
  title.textContent = "Nächste Termine";
  document.getElementById("railList").innerHTML = openT.slice(0,8).map(t => `<div class="item" data-task="${esc(t.id)}"><div class="d">${esc(t.when)} · ${esc(t.who)}</div>${esc(t.title)}</div>`).join("") || `<div class="empty">Keine offenen Termine.</div>`;
}
document.getElementById("whoChips").addEventListener("click", e => { const b = e.target.closest("[data-who]"); if(!b) return; state.who = b.dataset.who; document.querySelectorAll("#whoChips .chip").forEach(c => c.setAttribute("aria-pressed", c===b)); renderTasks(); });
document.getElementById("showDone").addEventListener("click", e => { state.showDone = !state.showDone; e.currentTarget.setAttribute("aria-pressed", state.showDone); renderTasks(); });

/* ===== Detail-Sheet ===== */
const sheet = document.getElementById("sheet"), scrim = document.getElementById("scrim");
function openSheet(html){ document.getElementById("sheetBody").innerHTML = html; sheet.classList.add("open"); scrim.classList.add("open"); document.getElementById("sheetClose").focus(); }
function closeSheet(){ sheet.classList.remove("open"); scrim.classList.remove("open"); }
scrim.addEventListener("click", closeSheet); document.getElementById("sheetClose").addEventListener("click", closeSheet);
document.addEventListener("keydown", e => { if(e.key==="Escape") closeSheet(); });
document.addEventListener("click", e => {
  const r = e.target.closest("[data-task]"); if(!r || r.closest(".sheet")) return;
  const t = state.tasks.find(x => x.id === r.dataset.task); if(!t) return;
  openSheet(`<h3 id="sheetTitle">${esc(t.title)}</h3><div class="when">${esc(t.when)}</div>${t._by ? `<div class="meta-line">Zuletzt geändert von ${esc(t._by)} · ${esc(stamp(t._at))}</div>` : ""}
    <div class="field"><label>Status</label><div class="seg" data-set="status" data-id="${esc(t.id)}">${STATUS.map(s=>`<button aria-pressed="${s===t.status}" data-v="${s}">${s}</button>`).join("")}</div></div>
    <div class="field"><label>Wer</label><div class="seg" data-set="who" data-id="${esc(t.id)}">${WHO.map(s=>`<button aria-pressed="${s===t.who}" data-v="${s}">${s}</button>`).join("")}</div></div>
    <div class="field"><label for="dateIn">Datum</label><input type="date" id="dateIn" value="${esc(t.sort||"")}" ${canWrite?"":"disabled"}></div>
    <div class="field"><label for="noteIn">Notiz</label><textarea id="noteIn" data-id="${esc(t.id)}" ${canWrite?"":"disabled"}>${esc(t.note||"")}</textarea></div>
    <div class="actions"><button class="btn" id="saveNote" ${canWrite?"":"disabled"}>Speichern</button><button class="btn danger" id="delTask" data-id="${esc(t.id)}" ${canWrite?"":"disabled"}>Aufgabe löschen</button></div>`);
});
sheet.addEventListener("click", async e => {
  const b = e.target.closest(".seg[data-id] button");
  if(b){ const seg = b.parentElement; const id = seg.dataset.id, field = seg.dataset.set, v = b.dataset.v;
    seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x===b));
    await write(`tasks/${id}`, {[field]: v});
  }
  if(e.target.id === "saveNote"){ const ta = document.getElementById("noteIn"); const dv = document.getElementById("dateIn").value;
    const upd = {note: ta.value.trim()}; const t = state.tasks.find(x=>x.id===ta.dataset.id);
    if(dv && dv !== t?.sort){ upd.sort = dv; upd.when = label(dv); }
    await write(`tasks/${ta.dataset.id}`, upd); e.target.textContent = "Gespeichert"; setTimeout(()=>{ e.target.textContent="Speichern"; }, 1500); }
  if(e.target.id === "delTask"){ if(!confirm("Diese Aufgabe wirklich löschen?")) return; try{ await db.doc(`tasks/${e.target.dataset.id}`).delete(); closeSheet(); }catch(err){ note("Löschen fehlgeschlagen."); } }
  if(e.target.id === "createTask"){
    const title = document.getElementById("newTitle").value.trim(); const dv = document.getElementById("newDate").value;
    const who = document.querySelector('#newWho button[aria-pressed="true"]')?.dataset.v || "Beide";
    if(!title){ document.getElementById("newTitle").focus(); return; }
    if(!db || !canWrite){ note("Speichern ist hier nicht möglich."); return; }
    try{ await db.collection("tasks").add({title, sort: dv || "", when: dv ? label(dv) : "offen", who, status:"Offen", note: document.getElementById("newNote").value.trim()}); closeSheet(); }
    catch(err){ note("Anlegen fehlgeschlagen."); }
  }
  const nw = e.target.closest("#newWho button"); if(nw){ nw.parentElement.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed", x===nw)); }
});

/* ===== Besprechen ===== */
function renderTalk(){
  const el = document.getElementById("talkList");
  if(!state.talk.length){ el.innerHTML = `<div class="empty">Keine offenen Themen.</div>`; return; }
  const list = [...state.talk].sort((a,b) => (a.decided - b.decided) || ((a.order||0)-(b.order||0)));
  el.innerHTML = list.map(t => `<details class="acc talk"><summary><span>${esc(t.title)}</span><span class="meta">${t.decided ? "entschieden" : "offen"}</span></summary>
    <div class="acc-body"><p class="body">${esc(t.body)}</p>
    ${t.decided ? `<p class="decided">Entscheidung: ${esc(t.decision)}</p>` : `
    <div class="field"><label>Entscheidung</label><textarea data-talk="${esc(t.id)}" ${canWrite?"":"disabled"} placeholder="Was habt ihr vereinbart?">${esc(t.decision||"")}</textarea></div>
    <button class="btn" data-decide="${esc(t.id)}" ${canWrite?"":"disabled"}>Als entschieden speichern</button>`}
    </div></details>`).join("");
}
document.getElementById("talkList").addEventListener("click", async e => {
  const b = e.target.closest("[data-decide]"); if(!b) return;
  const id = b.dataset.decide; const ta = document.querySelector(`textarea[data-talk="${CSS.escape(id)}"]`);
  const txt = (ta?.value || "").trim(); if(!txt){ ta?.focus(); return; }
  const t = state.talk.find(x => x.id===id);
  await write(`talk/${id}`, {decided:true, decision:txt});
  if(db){ try{ await db.collection("log").add({date:new Date().toISOString().slice(0,10), topic:t?.title||"Entscheidung", text:txt}); }catch(err){} }
});

/* ===== Wissen ===== */
function miniMeta(done, total){ const pct = total ? Math.round(done/total*100) : 0; return `<span class="mini ${done===total&&total?"full":""}"><span style="width:${pct}%"></span></span>${done}/${total}`; }
function renderWissen(){
  document.getElementById("wissen").innerHTML = WISSEN.map(w => {
    let body = w.html || "";
    if(w.checklist){
      const all = w.checklist.flatMap(([,items],gi) => items.map((_,ii)=>`${w.id}.${gi}.${ii}`));
      const done = all.filter(k => state.checks[k]).length;
      w.meta2 = miniMeta(done, all.length);
      body += w.checklist.map(([head,items],gi) => `<h4>${esc(head)}</h4>` + items.map((it,ii) => { const k=`${w.id}.${gi}.${ii}`; const on=!!state.checks[k]; return `<label class="check ${on?"on":""}"><input type="checkbox" data-check="${k}" ${on?"checked":""} ${canWrite?"":"disabled"}><span>${esc(it)}</span></label>`; }).join("")).join("");
    }
    return `<details class="acc" data-acc="${w.id}"><summary><span>${esc(w.title)}</span>${w.meta2 ? `<span class="meta">${w.meta2}</span>` : `<span class="meta desc">${esc(w.meta)}</span>`}</summary><div class="acc-body">${body}</div></details>`;
  }).join("");
}
document.getElementById("wissen").addEventListener("change", async e => {
  const c = e.target.closest("[data-check]"); if(!c) return;
  state.checks = {...state.checks, [c.dataset.check]: c.checked};
  c.closest(".check").classList.toggle("on", c.checked);
  await write("state/checks", {[c.dataset.check]: c.checked}, true);
});

/* ===== Log ===== */
function renderLog(){
  const qs = [...state.questions].sort((a,b)=>(a.n||0)-(b.n||0));
  document.getElementById("qMeta").innerHTML = miniMeta(qs.filter(q=>q.done).length, qs.length);
  document.getElementById("qList").innerHTML = qs.map(q => `<label class="check ${q.done?"on":""}"><input type="checkbox" data-q="${esc(q.id)}" ${q.done?"checked":""} ${canWrite?"":"disabled"}><span>${esc(q.n)}. ${esc(q.q)}${q.answer?` <b>– ${esc(q.answer)}</b>`:""}</span></label>`).join("") || "Keine Fragen gespeichert.";
  const logs = [...state.log].filter(l => l.kind!=="done").sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  document.getElementById("logMeta").textContent = logs.length;
  document.getElementById("logList").innerHTML = logs.map(l => `<p><b>${esc(fmt(l.date))} · ${esc(l.topic)}</b>${l._by ? ` <span class="by">· ${esc(l._by)}</span>` : ""}<br>${esc(l.text)}</p>`).join("") || "Noch keine Einträge.";
  const done = [...state.log].filter(l => l.kind==="done").sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const doneTasks = state.tasks.filter(t => t.status==="Erledigt");
  document.getElementById("doneMeta").textContent = done.length + doneTasks.length;
  document.getElementById("doneList").innerHTML = `<div class="tbl-wrap"><table class="tbl">${doneTasks.map(t=>`<tr><td>${esc(t.when)}</td><td>${esc(t.title)}</td></tr>`).join("")}${done.map(l=>`<tr><td>${esc(fmt(l.date))}</td><td>${esc(l.topic)} – ${esc(l.text)}</td></tr>`).join("")}</table></div>`;
}
function label(iso){ const d = parse(iso); if(!d) return ""; const p = n => String(n).padStart(2,"0"); return `${p(d.getDate())}.${p(d.getMonth()+1)}.` + (d.getFullYear()!==2026 ? d.getFullYear() : ""); }
function stamp(ts){ if(!ts) return ""; const d = new Date(ts); return d.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit"}) + " " + d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}); }
function fmt(iso){ const d = parse(iso); return d ? d.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"}) : (iso||""); }
document.getElementById("qList").addEventListener("change", async e => { const c = e.target.closest("[data-q]"); if(c) await write(`questions/${c.dataset.q}`, {done:c.checked}); });

/* ===== Speichern ===== */
async function write(path, data, merge){
  if(!db || !canWrite) return;
  try{ const ref = db.doc(path); if(merge){ const s = await ref.get(); if(s.exists) await ref.update(data); else await ref.set(data); } else await ref.update(data); }
  catch(err){ if(err?.code==="invalid_argument"){ canWrite=false; renderAll(); note("Nur Lesezugriff – Änderungen werden nicht gespeichert."); } else note("Speichern fehlgeschlagen. Bitte erneut versuchen."); }
}
function note(t){ document.getElementById("syncNote").textContent = t; }

function renderAll(){ renderHero(); renderHome(); renderTasks(); renderTalk(); renderWissen(); renderLog(); renderShop(); if(window.renderSettings) renderSettings(); if(window.renderBirth) renderBirth(); if(window.renderDailyTip) renderDailyTip(); }
document.getElementById("addBtn").addEventListener("click", () => state.view === "einkauf" ? document.getElementById("addShop").click() : openSheet(`<h3 id="sheetTitle">Neue Aufgabe</h3>
  <div class="field"><label for="newTitle">Was ist zu tun?</label><input type="text" id="newTitle" placeholder="z. B. Babyschale abholen"></div>
  <div class="field"><label for="newDate">Bis wann?</label><input type="date" id="newDate"></div>
  <div class="field"><label>Wer</label><div class="seg" id="newWho">${WHO.map(w=>`<button aria-pressed="${w==="Beide"}" data-v="${w}">${w}</button>`).join("")}</div></div>
  <div class="field"><label for="newNote">Notiz</label><textarea id="newNote"></textarea></div>
  <button class="btn" id="createTask">Aufgabe anlegen</button>`));
renderAll();
window.addEventListener("resize", () => { clearTimeout(window.__rs); window.__rs = setTimeout(renderHero, 150); });

