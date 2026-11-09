const CACHE_PREFIX = 'medicare-app-'
const CACHE_NAME = `${CACHE_PREFIX}v4`
const scopeUrl = new URL(self.registration.scope)
const scopePath = scopeUrl.pathname
const appUrl = new URL('./', scopeUrl).href
const offlineUrl = new URL('offline.html', scopeUrl).href
const faviconUrl = new URL('favicon.ico', scopeUrl).href
const publicOverviewPath = new URL('api/public/overview', scopeUrl).pathname

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([appUrl, offlineUrl, faviconUrl])),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ),
    ).then(() => self.clients.claim()),
  )
})

function isApiRequest(url) {
  return url.pathname.startsWith(`${scopePath}api/`)
}

function isPublicOverview(url) {
  return url.pathname === publicOverviewPath && !url.search
}

function isStaticAsset(url) {
  return /\.(?:avif|css|gif|ico|jpe?g|js|mjs|png|svg|webp|woff2?|ttf|otf)$/i.test(url.pathname)
}

function isSafeToCache(response) {
  const cacheControl = response.headers.get('cache-control') ?? ''
  return response.ok
    && response.type === 'basic'
    && !response.redirected
    && !response.headers.has('set-cookie')
    && !/\b(?:private|no-store)\b/i.test(cacheControl)
}

async function cacheResponse(cache, request, response) {
  if (isSafeToCache(response)) {
    try {
      await cache.put(request, response.clone())
    } catch (error) {
      console.warn('MediCare+ could not store a public resource in the offline cache.', error)
    }
  }
  return response
}

async function handleNavigation(request, url) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    const contentType = response.headers.get('content-type') ?? ''
    if (!url.search && contentType.includes('text/html')) {
      return cacheResponse(cache, request, response)
    }
    return response
  } catch {
    if (!url.search) {
      const cachedPage = await cache.match(request)
      if (cachedPage) return cachedPage
      const cachedAppShell = await cache.match(appUrl)
      if (cachedAppShell) return cachedAppShell
    }
    const offlinePage = await cache.match(offlineUrl)
    if (offlinePage) return offlinePage
    throw new Error('Offline fallback is not available in the application cache.')
  }
}

async function handlePublicOverview(request) {
  let cache
  try {
    cache = await caches.open(CACHE_NAME)
  } catch (error) {
    console.warn('MediCare+ could not open the public catalog cache.', error)
    return fetch(request)
  }

  try {
    const response = await fetch(request)
    const contentType = response.headers.get('content-type') ?? ''
    if (response.ok && contentType.includes('application/json')) {
      return cacheResponse(cache, request, response)
    }
    return response
  } catch (networkError) {
    let cachedCatalog
    try {
      cachedCatalog = await cache.match(request)
    } catch (cacheError) {
      console.warn('MediCare+ could not read the public catalog cache.', cacheError)
      throw networkError
    }
    if (!cachedCatalog) throw networkError

    const headers = new Headers(cachedCatalog.headers)
    headers.set('X-MediCare-Stale', 'true')
    return new Response(cachedCatalog.body, {
      status: cachedCatalog.status,
      statusText: cachedCatalog.statusText,
      headers,
    })
  }
}

async function handleStaticAsset(request, url) {
  const cache = await caches.open(CACHE_NAME)
  const isBuiltAsset = url.pathname.includes(`${scopePath}assets/`)
  const canUseCache = !url.search

  if (isBuiltAsset && canUseCache) {
    const cachedAsset = await cache.match(request)
    if (cachedAsset) return cachedAsset
  }

  try {
    const response = await fetch(request)
    if (canUseCache) {
      await cacheResponse(cache, request, response)
    }
    return response
  } catch (error) {
    if (canUseCache) {
      const cachedAsset = await cache.match(request)
      if (cachedAsset) return cachedAsset
    }
    throw error
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (
    request.method !== 'GET'
    || url.origin !== scopeUrl.origin
    || request.headers.has('authorization')
    || url.pathname === new URL('service-worker.js', scopeUrl).pathname
    || url.pathname.startsWith(`${scopePath}src/`)
    || url.pathname.startsWith(`${scopePath}node_modules/`)
    || url.pathname.startsWith(`${scopePath}@`)
    || url.pathname.startsWith(`${scopePath}__`)
  ) {
    return
  }

  if (isPublicOverview(url)) {
    event.respondWith(handlePublicOverview(request))
    return
  }

  if (isApiRequest(url)) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request, url))
  } else if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request, url))
  }
})
