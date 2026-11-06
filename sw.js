/* ===== sw.js – Service Worker: App offline verfügbar + Updates =====
   Bei jeder neuen Version VERSION erhöhen → App zeigt „Neue Version verfügbar“. */
const VERSION = "1.1.0";
const CACHE = "baby-cockpit-" + VERSION;
const SHELL = [
  "./", "index.html", "styles.css", "app.js", "db.js", "config.js",
  "manifest.webmanifest", "icon-180.png", "icon-512.png",
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
