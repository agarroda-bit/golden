// LLAVES · app instalable. Guarda la propia app para abrir rápido y sin conexión.
// Los datos: en modo local, el último datos.enc.json (cifrado); en modo nube, la copia cifrada en la bóveda del aparato.
const VERSION = 'llaves-v3-1';
const APP = ['./', 'index.html', 'app.js', 'calculo.js', 'catastro.js', 'plantillas.js', 'contacto.js', 'portales.js', 'nube.js', 'config.js', 'manifest.json', 'icono.svg', 'icono_180.png', 'icono_192.png', '../comun/boveda.js'];
const FUERA = ['https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all([...APP, ...FUERA].map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('llaves-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Nunca se guardan respuestas de Supabase (datos con sesión) ni de los portales
  if (/supabase\.co|idealista|fotocasa|habitaclia|pisos\.com/.test(u.hostname)) return;
  const mismo = u.origin === location.origin;
  const datos = /datos\.enc\.json$/.test(u.pathname);
  const deApp = mismo || FUERA.includes(u.href) || /cdn\.jsdelivr\.net\/npm\/@supabase/.test(u.href);
  if (!deApp && !/tile\.openstreetmap\.org/.test(u.hostname)) return;
  // Red primero (datos y la app, para tener siempre lo último); si no hay red, lo guardado.
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && (deApp || datos)) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || (datos ? new Response('{}', { status: 503 }) : Response.error()))));
});
