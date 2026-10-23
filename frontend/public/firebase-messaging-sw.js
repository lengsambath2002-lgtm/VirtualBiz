/* VirtualBiz push notifications (docs/ops/firebase.md). The page registers this worker with the
   public Firebase web config in its query string. Firebase shows each notification itself. */

// Opening a notification goes to its page. Firebase does this for https links; a local http one
// arrives in the data, so open it here. Registered before Firebase so ours runs first.
self.addEventListener('notificationclick', (event) => {
  const link = event.notification?.data?.FCM_MSG?.data?.link;
  if (!link || link.startsWith('https://')) return;
  event.notification.close();
  event.waitUntil(self.clients.openWindow(link));
});

importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js');

const q = new URL(self.location.href).searchParams;
firebase.initializeApp({
  apiKey: q.get('apiKey'),
  authDomain: q.get('authDomain'),
  projectId: q.get('projectId'),
  storageBucket: q.get('storageBucket'),
  messagingSenderId: q.get('messagingSenderId'),
  appId: q.get('appId'),
});
firebase.messaging();
