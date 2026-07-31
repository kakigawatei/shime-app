/* 締めアプリ service worker — アプリシェルをキャッシュ。データはlocalStorage（将来Firestore）。 */
var CACHE_VERSION = "shime-v21";
var SHELL = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_VERSION).then(function(c){ return c.addAll(SHELL); }).catch(function(){}));
});
self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE_VERSION; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});
self.addEventListener("fetch", function(e){
  var url = e.request.url;
  // 外部API（将来のFirestore等）はキャッシュせずネットワーク直行
  if(url.indexOf("googleapis.com")>=0 || e.request.method!=="GET"){ return; }
  // index.html はネットワーク優先（更新反映）、失敗時キャッシュ
  if(e.request.mode==="navigate" || url.indexOf("index.html")>=0){
    e.respondWith(fetch(e.request).then(function(r){
      var cp=r.clone(); caches.open(CACHE_VERSION).then(function(c){ c.put(e.request, cp); }); return r;
    }).catch(function(){ return caches.match(e.request).then(function(m){ return m || caches.match("./index.html"); }); }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function(m){ return m || fetch(e.request); }));
});
