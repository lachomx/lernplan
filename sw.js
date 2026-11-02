// Offline-Unterstützung: erst Netzwerk, bei fehlender Verbindung aus dem Cache.
const CACHE = 'lernplan-v6';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg',
  'js/app.js', 'js/plan.js', 'js/dates.js', 'js/store.js', 'js/vocab.js', 'js/logic.js', 'js/test.js', 'js/chart.js', 'js/ui.js', 'js/sync.js', 'js/csv.js', 'vokabelplan.json',
  'decks/00_Haeufige-Woerter.csv', 'decks/01_Yonsei-Wortschatz.csv', 'decks/02_Grammatik.csv', 'decks/03_Sprechen-Familie.csv', 'decks/04_Sprechen-Freunde.csv',
  'decks/05_Klettern.csv', 'decks/06_Psychologie.csv', 'decks/07_Grundwortschatz.csv',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('lernplan-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
