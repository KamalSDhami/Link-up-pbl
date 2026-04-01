self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'HEAD') {
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }

  if (url.pathname.includes('.')) {
    return
  }

  const blockedPrefixes = ['/api', '/supabase', '/functions', '/storage']
  if (blockedPrefixes.some((prefix) => url.pathname.startsWith(prefix))) {
    return
  }

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request)
        if (response.status !== 404) {
          return response
        }

        const headers = new Headers(response.headers)
        if (!headers.has('content-type')) {
          headers.set('content-type', 'text/html; charset=utf-8')
        }
        headers.set('x-head-fallback', 'sw-200')

        return new Response(null, {
          status: 200,
          statusText: 'OK',
          headers,
        })
      } catch (error) {
        return new Response(null, {
          status: 200,
          statusText: 'OK',
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'x-head-fallback': 'sw-200',
          },
        })
      }
    })(),
  )
})
