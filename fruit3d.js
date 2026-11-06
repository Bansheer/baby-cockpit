/* ===== fruit3d.js – drehbare 3D-Früchte (Three.js, prozedural, ohne externe Modelle) =====
   Wird erst geladen, wenn die Wochenansicht geöffnet wird. Export: mountFruit(container, model) → {dispose}. */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/* ---------- Hilfen ---------- */
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const V2 = (x, y) => new THREE.Vector2(x, y);

function tex(w, h, draw, repeat){
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if(repeat){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
function bump(w, h, draw, repeat){ const t = tex(w, h, draw, repeat); t.colorSpace = THREE.NoColorSpace; return t; }
function mat(o){ return new THREE.MeshPhysicalMaterial({roughness:.55, metalness:0, ...o}); }
// Rotationskörper aus Kontrollpunkten (Radius, Höhe)
function lathe(points, o = {}){
  const curve = new THREE.SplineCurve(points.map(([r, y]) => V2(r, y)));
  return new THREE.LatheGeometry(curve.getPoints(80), o.seg || 96, o.phiStart || 0, o.phiLength || Math.PI * 2);
}
// Längsrippen (Kürbis, Melone): Radius abhängig vom Winkel
function ribs(geo, n, depth){
  const p = geo.attributes.position, v = new THREE.Vector3();
  for(let i = 0; i < p.count; i++){
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x), k = 1 - depth * Math.pow(Math.abs(Math.sin(a * n / 2)), 1.6);
    p.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  geo.computeVertexNormals(); return geo;
}
function stem(color, h = .35, r = .06){
  const g = new THREE.CylinderGeometry(r * .8, r, h, 12, 4);
  const p = g.attributes.position, v = new THREE.Vector3();
  for(let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); p.setX(i, v.x + Math.sin((v.y + h/2) * 4) * .04); }
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat({color, roughness:.8}));
}
function leafShell(geo, material, rotY, tilt){ const m = new THREE.Mesh(geo, material); m.rotation.set(tilt, rotY, 0); return m; }

/* ---------- Texturen ---------- */
const stripesTex = (base, stripe, n, jag) => tex(1024, 512, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = stripe;
  for(let s = 0; s < n; s++){ const x0 = s * w / n; g.beginPath(); g.moveTo(x0, 0);
    for(let y = 0; y <= h; y += 16) g.lineTo(x0 + Math.sin(y * .09 + s) * jag + (rnd() - .5) * jag, y);
    for(let y = h; y >= 0; y -= 16) g.lineTo(x0 + w / n * .45 + Math.sin(y * .07 + s * 2) * jag + (rnd() - .5) * jag, y);
    g.fill(); }
});
const speckleTex = (base, dot, count, size) => tex(1024, 512, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for(let i = 0; i < count; i++){ g.fillStyle = dot; g.globalAlpha = .25 + rnd() * .4; g.beginPath(); g.arc(rnd() * w, rnd() * h, rnd() * size + .5, 0, 7); g.fill(); }
  g.globalAlpha = 1;
});
const gradientTex = (stops, rib) => tex(512, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, h, 0, 0); stops.forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  if(rib){ g.strokeStyle = rib; g.lineWidth = 10; g.globalAlpha = .7;
    for(let i = 0; i < 6; i++){ const x = (i + .5) * w / 6; g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + 8, h * .5, x - 4, 0); g.stroke(); }
    g.lineWidth = 2; g.globalAlpha = .35;
    for(let i = 0; i < 60; i++){ const x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 60, y - 30 - rnd() * 40); g.stroke(); }
    g.globalAlpha = 1; }
});
const veinTex = (base, vein) => tex(512, 512, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h); g.strokeStyle = vein; g.globalAlpha = .55;
  for(let i = 0; i < 9; i++){ const x = (i + .5) * w / 9; g.lineWidth = 6; g.beginPath(); g.moveTo(x, h); g.bezierCurveTo(x + 30, h * .6, x - 30, h * .3, x + 10, 0); g.stroke();
    g.lineWidth = 2; for(let j = 0; j < 8; j++){ const y = h * (j + .5) / 8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40 * (rnd() > .5 ? 1 : -1), y - 30); g.stroke(); } }
  g.globalAlpha = 1;
});

/* ---------- Früchte ---------- */
const FRUITS = {
  aubergine(){
    const G = new THREE.Group();
    const body = new THREE.Mesh(lathe([[0,-1.15],[.45,-1.08],[.7,-.75],[.72,-.25],[.55,.35],[.4,.8],[.3,1.05],[0,1.12]]),
      mat({color:"#3b1340", roughness:.22, clearcoat:1, clearcoatRoughness:.15, sheen:.3, sheenColor:"#7a3a8a"}));
    G.add(body);
    const green = mat({color:"#5f7d3a", roughness:.7});
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.32, 32, 16, 0, Math.PI*2, 0, Math.PI/2.2), green); cap.position.y = .96; G.add(cap);
    for(let i = 0; i < 5; i++){ const s = new THREE.Mesh(new THREE.SphereGeometry(.3, 16, 8), green);
      s.scale.set(.35, .07, 1); const a = i / 5 * Math.PI * 2; s.position.set(Math.cos(a) * .22, .9, Math.sin(a) * .22); s.rotation.set(.7 * Math.sin(a), -a, .7 * Math.cos(a)); G.add(s); }
    const st = stem("#6f7a3e", .45, .07); st.position.y = 1.25; G.add(st);
    G.rotation.z = .25; return G;
  },
  butternut(){
    const G = new THREE.Group();
    const t = stripesTex("#e2b26f", "#ecc890", 10, 6);
    G.add(new THREE.Mesh(lathe([[0,-1.05],[.45,-1],[.75,-.72],[.8,-.35],[.62,-.02],[.46,.3],[.42,.65],[.36,.95],[.12,1.04],[0,1.05]]), mat({map:t, roughness:.6, clearcoat:.2})));
    const st = stem("#8a7346", .3, .1); st.position.y = 1.15; G.add(st);
    return G;
  },
  kohl(){
    const G = new THREE.Group();
    G.add(new THREE.Mesh(new THREE.SphereGeometry(.82, 64, 32), mat({map:veinTex("#d6e8ad", "#f4f8e4"), roughness:.5})));
    const lm = mat({map:veinTex("#b9d58b", "#eef6d8"), side:THREE.DoubleSide, roughness:.5, sheen:.4, sheenColor:"#ffffff"});
    for(let i = 0; i < 8; i++){
      const geo = new THREE.SphereGeometry(.86 + i * .022, 48, 24, rnd() * 6.28, 1.6 + rnd() * .8, .55 + rnd() * .35, 1.6 + rnd() * .35);
      G.add(leafShell(geo, lm, rnd() * 6.28, (rnd() - .5) * .5));
    }
    G.scale.set(1, .92, 1); return G;
  },
  kokos(){
    const G = new THREE.Group();
    const fib = tex(1024, 512, (g, w, h) => { g.fillStyle = "#6b4a2f"; g.fillRect(0, 0, w, h);
      for(let i = 0; i < 9000; i++){ const x = rnd() * w, y = rnd() * h, l = 6 + rnd() * 18; g.strokeStyle = rnd() > .5 ? "#8b6440" : "#4d3320"; g.globalAlpha = .5; g.lineWidth = 1 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 4, y + l); g.stroke(); } });
    const geo = new THREE.SphereGeometry(.9, 64, 32); geo.scale(1, 1.1, 1);
    G.add(new THREE.Mesh(geo, mat({map:fib, bumpMap:fib, bumpScale:2.5, roughness:.95})));
    const eye = mat({color:"#2a1a10", roughness:.9});
    [[0,.3],[2.1,.28],[4.2,.3]].forEach(([a]) => { const e = new THREE.Mesh(new THREE.SphereGeometry(.09, 16, 8), eye); e.position.set(Math.cos(a) * .2, .95, Math.sin(a) * .2); G.add(e); });
    return G;
  },
  chinakohl(){
    const G = new THREE.Group();
    const prof = [[0,-1.25],[.45,-1.15],[.6,-.6],[.6,.2],[.56,.8],[.36,1.18],[0,1.28]];
    const t = gradientTex([[0,"#fbfbf2"],[.35,"#f1f4d6"],[.7,"#c4dc86"],[1,"#93c05a"]], "#ffffff");
    G.add(new THREE.Mesh(lathe(prof), mat({map:t, roughness:.5})));
    const lm = mat({map:t, side:THREE.DoubleSide, roughness:.5});
    for(let i = 0; i < 6; i++){ const geo = lathe(prof.map(([r, y]) => [r * (1.04 + i * .025), y * (1 + i * .01)]), {phiStart:rnd() * 6.28, phiLength:1.3 + rnd() * .7, seg:48});
      const p = geo.attributes.position, v = new THREE.Vector3();
      for(let k = 0; k < p.count; k++){ v.fromBufferAttribute(p, k); if(v.y > .55){ const w = Math.sin(v.x * 22 + v.z * 19) * .035 * (v.y - .55); p.setXYZ(k, v.x + w, v.y, v.z + w); } }
      geo.computeVertexNormals(); G.add(new THREE.Mesh(geo, lm)); }
    return G;
  },
  ananas(){
    const G = new THREE.Group();
    const scales = (isBump) => (isBump ? bump : tex)(512, 512, (g, w, h) => {
      g.fillStyle = isBump ? "#777" : "#c98d32"; g.fillRect(0, 0, w, h);
      const n = 8, s = w / n;
      for(let r = 0; r < n * 2; r++) for(let c = 0; c < n + 1; c++){
        const x = c * s + (r % 2 ? s / 2 : 0), y = r * s / 2;
        g.beginPath(); g.moveTo(x, y - s * .48); g.lineTo(x + s * .48, y); g.lineTo(x, y + s * .48); g.lineTo(x - s * .48, y); g.closePath();
        if(isBump){ const gr = g.createRadialGradient(x, y, 2, x, y, s * .5); gr.addColorStop(0, "#fff"); gr.addColorStop(1, "#222"); g.fillStyle = gr; g.fill(); }
        else { const gr = g.createRadialGradient(x, y, 2, x, y, s * .5); gr.addColorStop(0, "#e2ad4c"); gr.addColorStop(.7, "#b77a28"); gr.addColorStop(1, "#6e4a1c"); g.fillStyle = gr; g.fill();
          g.fillStyle = "#4b3214"; g.beginPath(); g.arc(x, y + s * .1, 3, 0, 7); g.fill(); }
      }
    }, [4, 3]);
    G.add(new THREE.Mesh(lathe([[0,-1.05],[.55,-1],[.72,-.55],[.74,.05],[.64,.55],[.38,.85],[0,.9]]), mat({map:scales(false), bumpMap:scales(true), bumpScale:3, roughness:.6})));
    const lm = mat({color:"#3f7a3c", roughness:.55, side:THREE.DoubleSide});
    for(let i = 0; i < 26; i++){
      const len = .5 + rnd() * .45, leaf = new THREE.Mesh(new THREE.ConeGeometry(.07, len, 6), lm);
      leaf.scale.z = .35; const a = i * 2.4, tilt = .15 + (i / 26) * .9;
      leaf.position.set(Math.cos(a) * .08, .88 + len / 2 * Math.cos(tilt), Math.sin(a) * .08);
      leaf.rotation.set(0, -a, 0); leaf.rotateZ(-tilt); leaf.translateY(len * .1); G.add(leaf);
    }
    return G;
  },
  cantaloupe(){
    const G = new THREE.Group();
    const net = (isBump) => (isBump ? bump : tex)(1024, 512, (g, w, h) => {
      g.fillStyle = isBump ? "#333" : "#a9a46f"; g.fillRect(0, 0, w, h);
      const pts = Array.from({length:1100}, () => [rnd() * w, rnd() * h]);
      g.strokeStyle = isBump ? "#fff" : "#ece4c6"; g.lineWidth = 2.2;
      pts.forEach(p => { pts.map(q => [q, (q[0]-p[0])**2 + (q[1]-p[1])**2]).sort((a, b) => a[1] - b[1]).slice(1, 4).forEach(([q]) => { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); }); });
    });
    const geo = ribs(new THREE.SphereGeometry(.95, 96, 48), 10, .04); geo.scale(1, .95, 1);
    G.add(new THREE.Mesh(geo, mat({map:net(false), bumpMap:net(true), bumpScale:3, roughness:.75})));
    return G;
  },
  honigmelone(){
    const geo = new THREE.SphereGeometry(.92, 64, 32); geo.scale(1, 1.12, 1);
    const G = new THREE.Group();
    G.add(new THREE.Mesh(geo, mat({map:speckleTex("#e4e2a2", "#c9c77c", 2500, 2), roughness:.32, clearcoat:.4})));
    return G;
  },
  roemersalat(){
    const G = new THREE.Group();
    const prof = [[0,-1.2],[.32,-1.1],[.5,-.5],[.56,.35],[.5,.95],[.2,1.3],[0,1.32]];
    const t = gradientTex([[0,"#f1f5d6"],[.4,"#c4dd87"],[1,"#4f8a3a"]], "#f4f8e0");
    G.add(new THREE.Mesh(lathe(prof), mat({map:t, roughness:.5})));
    const lm = mat({map:t, side:THREE.DoubleSide, roughness:.5, sheen:.3});
    for(let i = 0; i < 7; i++){
      const geo = lathe(prof.map(([r, y]) => [r * (1.05 + i * .035), y * (1 + i * .01)]), {phiStart:rnd() * 6.28, phiLength:1.2 + rnd() * .8, seg:48});
      const p = geo.attributes.position, v = new THREE.Vector3();
      for(let k = 0; k < p.count; k++){ v.fromBufferAttribute(p, k); if(v.y > .5){ const w = Math.sin(v.x * 18 + v.z * 14) * .04 * (v.y - .5); p.setXYZ(k, v.x + w, v.y, v.z + w); } }
      geo.computeVertexNormals(); G.add(new THREE.Mesh(geo, lm));
    }
    return G;
  },
  mangold(){
    const G = new THREE.Group();
    const cols = ["#c0263a", "#f2c230", "#f4f1e6", "#d8402e", "#e8692c"];
    const leafMat = mat({map:veinTex("#2f6b33", "#c24a5a"), side:THREE.DoubleSide, roughness:.45, sheen:.4, sheenColor:"#9fd18a"});
    cols.forEach((c, i) => {
      const S = new THREE.Group();
      const st = new THREE.Mesh(new THREE.CylinderGeometry(.045, .06, 1.1, 12), mat({color:c, roughness:.35, clearcoat:.5}));
      st.position.y = -.25; S.add(st);
      const g = new THREE.PlaneGeometry(1, 1.3, 16, 24), p = g.attributes.position;
      for(let k = 0; k < p.count; k++){ const x = p.getX(k), y = p.getY(k), v = (y + .65) / 1.3;
        const wf = Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.04)), .8) * (1 - .3 * v), xx = x * wf;
        p.setX(k, xx); p.setZ(k, -xx * xx * .7 + Math.sin(v * 7 + x * 3) * .025); }
      g.computeVertexNormals(); const leaf = new THREE.Mesh(g, leafMat); leaf.position.y = .95; S.add(leaf);
      S.rotation.set(0, (i - 2) * .35, (i - 2) * .24); G.add(S);
    });
    const band = new THREE.Mesh(new THREE.TorusGeometry(.17, .03, 8, 24), mat({color:"#c9a66b", roughness:.9})); band.rotation.x = Math.PI / 2; band.position.y = -.5; G.add(band);
    return G;
  },
  lauch(){
    const G = new THREE.Group();
    const t = gradientTex([[0,"#fbfbf5"],[.55,"#f2f5e3"],[.8,"#bcd79a"],[1,"#7fa86a"]]);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.24, .27, 1.7, 48, 8), mat({map:t, roughness:.35, clearcoat:.3}));
    body.position.y = -.35; G.add(body);
    const lm = mat({color:"#4c7a52", roughness:.5, side:THREE.DoubleSide});
    for(let i = 0; i < 6; i++){
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(.22, 1.4, 10, 1, true), lm);
      leaf.scale.z = .28; const a = i * 1.05; leaf.position.set(Math.cos(a) * .06, 1.05, Math.sin(a) * .06);
      leaf.rotation.set(0, -a, 0); leaf.rotateZ(-.18 - (i % 3) * .14); leaf.translateY(.1); G.add(leaf);
    }
    const rm = mat({color:"#d9c9a3", roughness:.9});
    for(let i = 0; i < 18; i++){ const r = new THREE.Mesh(new THREE.CylinderGeometry(.008, .004, .22, 4), rm); const a = rnd() * 6.28;
      r.position.set(Math.cos(a) * .12 * rnd(), -1.3, Math.sin(a) * .12 * rnd()); r.rotation.set((rnd() - .5) * 1.2, 0, (rnd() - .5) * 1.2); G.add(r); }
    G.rotation.z = .15; return G;
  },
  wassermelone(){
    const geo = new THREE.SphereGeometry(.98, 64, 32); geo.scale(1, .92, 1);
    const G = new THREE.Group();
    G.add(new THREE.Mesh(geo, mat({map:stripesTex("#88b05f", "#2d5a28", 14, 10), roughness:.3, clearcoat:.6, clearcoatRoughness:.3})));
    const st = stem("#7d6a3c", .12, .03); st.position.y = .92; G.add(st);
    return G;
  },
  kuerbis(){
    const G = new THREE.Group();
    const geo = ribs(new THREE.SphereGeometry(1, 128, 64), 10, .12); geo.scale(1, .78, 1);
    // Mulde oben und unten
    const p = geo.attributes.position, v = new THREE.Vector3();
    for(let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); const r = Math.hypot(v.x, v.z); if(r < .35) p.setY(i, v.y * (.75 + r * .7)); }
    geo.computeVertexNormals();
    G.add(new THREE.Mesh(geo, mat({map:stripesTex("#e9802a", "#d96a1c", 10, 4), roughness:.5, clearcoat:.25})));
    const st = stem("#6b6a35", .4, .09); st.position.y = .72; G.add(st);
    return G;
  }
};

/* ---------- Szene, Licht, Drehen ---------- */
export function mountFruit(el, model, opt = {}){
  const canvas = document.createElement("canvas"); el.querySelector("canvas")?.remove(); el.appendChild(canvas);
  let renderer;
  try{ renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, preserveDrawingBuffer:true}); }
  catch(e){ return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
  const cam = new THREE.PerspectiveCamera(32, 1, .1, 50); cam.position.set(0, .5, 6.2); cam.lookAt(0, 0, 0);
  const key = new THREE.DirectionalLight("#fff4ec", 1.6); key.position.set(3, 4, 4); scene.add(key);
  const rim = new THREE.DirectionalLight("#ffd6e6", 1.0); rim.position.set(-4, 2, -3); scene.add(rim);
  scene.add(new THREE.HemisphereLight("#ffffff", "#f2cfdc", .5));

  seed = 7;
  const fruit = (FRUITS[model] || FRUITS.kohl)();
  // auf einheitliche Größe bringen und zentrieren
  const box = new THREE.Box3().setFromObject(fruit), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = 2.8 / Math.max(size.x, size.y, size.z);
  const holder = new THREE.Group(); fruit.position.sub(c); holder.add(fruit); holder.scale.setScalar(k); scene.add(holder);
  // weicher Kontaktschatten
  const sh = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), new THREE.MeshBasicMaterial({transparent:true, depthWrite:false,
    map:tex(256, 256, (g, w, h) => { const gr = g.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2); gr.addColorStop(0, "rgba(90,30,60,.35)"); gr.addColorStop(1, "rgba(90,30,60,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); })}));
  sh.rotation.x = -Math.PI / 2; sh.position.y = -size.y * k / 2 - .05; scene.add(sh);

  // Drehen per Finger/Maus mit Schwung, sonst langsames Selbstdrehen
  let rx = .12, ry = .4, vx = 0, vy = .006, drag = false, lx = 0, ly = 0, idle = 0;
  const down = e => { drag = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); };
  const move = e => { if(!drag) return; vy = (e.clientX - lx) * .008; vx = (e.clientY - ly) * .006; lx = e.clientX; ly = e.clientY; ry += vy; rx = Math.max(-.8, Math.min(.8, rx + vx)); idle = 0; };
  const up = () => { drag = false; };
  canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  canvas.style.touchAction = "pan-y";

  const resize = () => { const w = el.clientWidth || 300, h = el.clientHeight || 260; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  resize(); const ro = new ResizeObserver(resize); ro.observe(el);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;
  let introT = opt.intro && !matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1, last = performance.now(), first = true;
  holder.scale.setScalar(introT < 1 ? k * .2 : k);   // ohne Animation sofort in voller Größe
  const easeBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const loop = () => {
    const now = performance.now(), dt = Math.min((now - last) / 1000, .05); last = now;
    if(introT < 1){ introT = Math.min(1, introT + dt / .9); holder.scale.setScalar(k * (.2 + .8 * easeBack(introT))); }
    if(!drag){ idle++; vy *= .95; vx *= .9; ry += vy; rx += vx; if(idle > 90 && !reduce) ry += .004; rx += (.12 - rx) * .02; }
    holder.rotation.set(rx, ry - (1 - Math.pow(introT, .5)) * Math.PI * 1.4, 0);
    renderer.render(scene, cam); raf = requestAnimationFrame(loop);
    if(first){ first = false; opt.onReady && opt.onReady(); }
  };
  loop();
  return { dispose(){ cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); pm.dispose(); scene.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => { m.map?.dispose(); m.bumpMap?.dispose(); m.dispose(); }); }); } };
}

/* Standbild als PNG (transparent) – für Vorschaubilder auf der Startseite */
export function renderStill(model, px = 512){
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, preserveDrawingBuffer:true});
  renderer.setSize(px, px); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(), pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
  const key = new THREE.DirectionalLight("#fff4ec", 1.6); key.position.set(3, 4, 4); scene.add(key);
  const rim = new THREE.DirectionalLight("#ffd6e6", 1.0); rim.position.set(-4, 2, -3); scene.add(rim);
  scene.add(new THREE.HemisphereLight("#ffffff", "#f2cfdc", .5));
  seed = 7; const fruit = (FRUITS[model] || FRUITS.kohl)();
  const box = new THREE.Box3().setFromObject(fruit), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const holder = new THREE.Group(); fruit.position.sub(c); holder.add(fruit); holder.scale.setScalar(2.6 / Math.max(size.x, size.y, size.z)); holder.rotation.set(.18, .5, -.12); scene.add(holder);
  const cam = new THREE.PerspectiveCamera(30, 1, .1, 50); cam.position.set(0, .4, 6.2); cam.lookAt(0, 0, 0);
  renderer.render(scene, cam); const url = renderer.domElement.toDataURL("image/png"); renderer.dispose(); return url;
}
