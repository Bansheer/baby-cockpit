/* ===== sw.js – Service Worker: App offline verfügbar + Updates =====
   Bei jeder neuen Version VERSION erhöhen → App zeigt „Neue Version verfügbar“. */
const VERSION = "1.6.0";
const CACHE = "baby-cockpit-" + VERSION;
const SHELL = [
  "./", "index.html", "styles.css", "content.js", "app.js", "birth.js", "week.js", "breath.js", "ui.js", "push.js", "widget.js", "docs.js", "fruit3d.js", "db.js", "config.js",
  "manifest.webmanifest", "icon-180.png", "icon-512.png", "img/ava-lena.png", "img/ava-hannes.png", "img/baby.png",
  ...[28,29,30,31,32,33,34,35,36,37,38,39,40].map(w => `img/w${w}.png`),
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js"
];

// Installieren: App-Dateien frisch vom Server in den Cache legen
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, {cache:"reload"})).catch(() => {})))));
});

// Aktivieren: alte Versionen aufräumen
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("baby-cockpit-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Nutzer hat „Aktualisieren“ getippt
self.addEventListener("message", e => { if(e.data === "skipWaiting") self.skipWaiting(); });

// Abrufe: Daten (Supabase) immer live; App-Dateien und Schrift aus dem Cache, im Hintergrund auffrischen
self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.hostname.endsWith("supabase.co")) return;
  const isShell = url.origin === location.origin || url.hostname === "cdn.jsdelivr.net";
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if(!isShell && !isFont) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, {ignoreSearch: isShell});
    const net = fetch(req).then(res => { if(res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => null);
    if(hit){ if(isFont) return hit; e.waitUntil(net); return hit; }
    const res = await net;
    return res || (req.mode === "navigate" ? c.match("index.html") : Response.error());
  }));
});

// Push-Mitteilung anzeigen
self.addEventListener("push", e => {
  let m = {}; try{ m = e.data ? e.data.json() : {}; }catch(err){ m = {title:"Baby-Cockpit", body:e.data ? e.data.text() : ""}; }
  e.waitUntil(self.registration.showNotification(m.title || "Baby-Cockpit", {
    body:m.body || "", icon:"icon-180.png", badge:"icon-180.png", tag:m.tag || undefined, data:{url:m.url || "./"}
  }));
});
// Antippen: App öffnen bzw. nach vorne holen und passende Ansicht zeigen
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:"window", includeUncontrolled:true}).then(list => {
    const c = list.find(x => x.url.startsWith(self.registration.scope));
    if(c){ c.postMessage({open:new URL(target).hash.replace("#", "")}); return c.focus(); }
    return self.clients.openWindow(target);
  }));
});
