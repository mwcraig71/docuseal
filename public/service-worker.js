self.addEventListener('install', () => {
  console.log('STRSeal App installed')
})

self.addEventListener('activate', () => {
  console.log('STRSeal App activated')
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
