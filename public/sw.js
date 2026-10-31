'use strict';
// Push only: no page, login, form or document caching.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{}}catch{}
 event.waitUntil(self.registration.showNotification(data.title||'NOVO CADASTRO RECEBIDO!',{body:data.body||'Abra a Área ADM para conferir.',icon:'/icon-192.png',badge:'/icon-192.png',tag:data.tag||'cadastro-aviso',data:{url:'/?adm=1'},renotify:true}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{const url=new URL('/?adm=1',self.location.origin).href;const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.navigate(url);return client.focus();}}return self.clients.openWindow(url);})());
});
