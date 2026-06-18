// ─── Service Worker — Carteirinha de Vacinas ─────────────────────────────────
// Versão do cache: altere este número ao publicar uma atualização
// para que todos os usuários recebam a versão nova automaticamente.
const CACHE_VERSION = 'v2';
const CACHE_NAME    = `carteirinha-${CACHE_VERSION}`;

// ── Arquivos ESSENCIAIS — o app não funciona sem eles.
// Se qualquer um falhar no cache, o install é abortado e o SW não assume.
const CORE_ASSETS = [
  './index.html',
  './manifest.json',
  './config.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── Arquivos opcionais — imagens, figurinhas, foto do médico.
// Falhas aqui são ignoradas; o app ainda funciona sem elas.
const OPTIONAL_ASSETS = [
  './img/00.Legenda.png',
  './img/01.BCG.png',
  './img/02.HepatiteB.png',
  './img/03.Nirsevimabe.png',
  './img/04.Rotavirus.png',
  './img/05.Polio.png',
  './img/06.Pentavalente.png',
  './img/07.Hexavalente.png',
  './img/08.DTP.png',
  './img/09.Pneumococo.png',
  './img/10.MeningoC.png',
  './img/11.MeningoACWY.png',
  './img/12.MeningoB.png',
  './img/13.COVID19.png',
  './img/14.Gripe.png',
  './img/15.FebreAmarela.png',
  './img/16.TripliceViral.png',
  './img/17.Tetraviral.png',
  './img/18.Varicela.png',
  './img/19.HepatiteA.png',
  './img/20.HPV.png',
  './img/21.Dengue.png',
  './img/31.dT.png',
  './img/38.Pneumococo.png',
  './img/39.Pneumococo.png',
  './img/40.Pneumococo.png',
  './img/41.Gripe.png',
  './img/42.HPV.png',
  './img/44.Rotavirus.png',
  './img/50.VSR.png',
  './img/88.Dengue.png',
  './img/91.MeningoACWY.png',
  './mylene_foto.jpg',
];

// ─── Instalação ───────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // 1. Cacheia os arquivos essenciais — falha aqui aborta o SW
      await cache.addAll(CORE_ASSETS);

      // 2. Cacheia os opcionais individualmente — falhas são ignoradas
      await Promise.allSettled(
        OPTIONAL_ASSETS.map(url =>
          cache.add(url).catch(() =>
            console.warn('[SW] Asset opcional não encontrado:', url)
          )
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── Ativação: remove caches antigos ─────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('carteirinha-') && k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Removendo cache antigo:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  // Ignora requisições não-GET (ex: POST do analytics)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isConfig = url.pathname.endsWith('config.json');
  const isNavigation = event.request.mode === 'navigate';

  if (isNavigation || isConfig) {
    // ── Network-First para navegação e config.json ──
    // Garante que o usuário sempre receba a versão mais recente quando online.
    // Se offline, cai no cache.
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(cached =>
            cached || caches.match('./index.html')
          )
        )
    );
  } else {
    // ── Cache-First para todos os outros assets ──
    // Rede como fallback; armazena no cache para uso futuro.
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {
          // Sem rede e sem cache: retorna vazio sem travar o app
          return new Response('', { status: 408, statusText: 'Offline' });
        });
      })
    );
  }
});
