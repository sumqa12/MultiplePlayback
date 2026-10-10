// Service Worker
// 注意: このファイルはルート直下に置くこと。
// スコープは自身の階層以下になるため、dist/ 配下に出力するとトップページを制御できない。
// そのためTypeScriptではなく素のJSとして管理している。
//
// 更新手順: アセットを変更したら CACHE_VERSION を上げる（上げないと古いファイルが配信され続ける）

const CACHE_VERSION = 'v1';
const CACHE_NAME = `multiple-playback-${CACHE_VERSION}`;

// オフライン起動に必要なアプリシェル一式
const ASSETS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './dist/src/index.js',
    './dist/src/player.js',
    './dist/src/css/style.css',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            // cache:'reload' でブラウザのHTTPキャッシュを迂回し、必ず最新を取得する
            .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;

    if (request.method !== 'GET') {
        return;
    }

    // blob: など同一オリジン以外のスキームはそのまま通す（音声のオブジェクトURLなど）
    if (!request.url.startsWith(self.location.origin)) {
        return;
    }

    // すべてローカル完結のアセットなのでキャッシュ優先で問題ない
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                return cached;
            }
            return fetch(request).catch(() => {
                // オフライン時のページ遷移はアプリシェルを返す
                if (request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                return Response.error();
            });
        })
    );
});
