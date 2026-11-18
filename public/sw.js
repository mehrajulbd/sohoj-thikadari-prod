const CACHE='sohoz-public-v1';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/','/icon.svg','/manifest.webmanifest','/fonts/NotoSansBengali.ttf']))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')self.skipWaiting();if(event.data?.type==='CACHE_SHELL'){const urls=event.data.urls.filter(value=>{try{const url=new URL(value);return url.origin===location.origin&&url.pathname.startsWith('/_next/static/');}catch{return false;}});event.waitUntil(caches.open(CACHE).then(cache=>Promise.all(urls.map(url=>cache.add(url).catch(()=>{})))));}});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/')||url.pathname.startsWith('/reset-password'))return;
 // Never cache Supabase requests, tokens, or private API responses. HTML contains only the public client shell.
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).then(response=>{if(response.ok&&url.pathname==='/'){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('/',copy));}return response;}).catch(()=>caches.match('/').then(cached=>cached||Response.error())));return;
 }
 if(url.pathname.startsWith('/_next/static/')||url.pathname.startsWith('/fonts/')||url.pathname.startsWith('/icon'))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;})));
});
