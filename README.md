# MediCare+ Frontend

Clinic management frontend built with Vue 3, TypeScript, Vue Router, and Vite. The UI reads and writes records through the LavaLust API.

## Run locally

Start the backend first. The frontend Vite server proxies `/api` to `http://127.0.0.1:8083`; leave `VITE_API_BASE_URL` empty when developing locally.

```sh
npm install
npm run dev
```

Build and type-check:

```sh
npm run build
```

## Deploy as a Render Static Site

1. Create a **Static Site** from this repository's `main` branch.
2. Set the build command to `npm ci && npm run build-only` and the publish directory to `dist`.
3. Add the build-time environment variable `VITE_API_BASE_URL` with the backend origin, for example `https://your-backend.onrender.com` (no trailing slash). Trigger a new deploy after setting or changing it.
4. Configure a rewrite from `/*` to `/index.html` so Vue Router routes load directly.
5. On the backend Render service, set `FRONTEND_URL` to this site's origin and add the same origin to `CORS_ALLOWED_ORIGINS`.

The API client uses the same-origin Vite proxy in local development and `VITE_API_BASE_URL` in the static production build. Never put backend credentials or private API keys in `VITE_*` variables.

## Offline behavior

The Service Worker registers on `localhost` during development and on HTTPS in production. Serve the built `dist/` directory at the app's origin and base path so the worker can control the application. When the API is on a separate origin, authenticated API requests go directly to the backend and require the backend CORS allowlist described above.

The browser's Cache Storage holds the application shell, offline page, public static assets, and—when served same-origin—the public `/api/public/overview` catalog only. Hashed build assets are cache-first; page navigations and the public catalog are network-first, with cached fallbacks when offline. Offline catalog results are labeled as potentially out of date and refreshed when connectivity returns. The worker never caches authenticated requests, other API responses, or URLs with query parameters. Its version is `medicare-app-v1` in `public/service-worker.js`; bump that version for each frontend release so activation removes the previous app cache.

Private patient, appointment, payment, message, and other API data is not stored for offline use. Offline users can view the public clinic catalog and load the application shell and previously visited pages, but private API-backed records, sign-in, and create/update/delete actions require a connection. No offline write queue is used. The existing session token remains in session storage and is not copied into the Service Worker cache.

To test offline behavior:

1. Run the backend and `npm run dev`, then open the Vite URL in a browser using `localhost`.
2. Visit the home page and a lazy-loaded route (such as registration) while online. In browser developer tools, confirm the Service Worker is activated and `medicare-app-v1` appears under Application/Storage > Cache Storage.
3. In developer tools, switch the Network panel to **Offline**, then reload a route visited through the app. The cached app shell and already-loaded route assets should render with an offline/connection banner. Open `/offline.html` directly to test the branded fallback.
4. Try an API-backed action; it should report the connection failure and must not claim that data was saved. Restore the network and reload to continue.

The backend marks dynamic PHP responses `private, no-store`, except the explicitly public catalog endpoint, which is cacheable for five minutes. Apache may cache only public static files for one day. No package installation beyond the existing `npm install` is required.

The backend guide includes the site map, wireframes, ERD, schema, route list, demo setup, and CRUD demonstration checklist.

## Routes

- `/login` — staff sign-in
- `/` — database-backed summary
- `/patients` — searchable directory and admin CRUD form
- `/patients/:id` — record details

The staff and admin workspace also includes the prototype's clinic sections: appointment scheduling, patient management, dental records with an interactive 32-tooth chart, dentist schedules, treatments, prescriptions, billing, messages, reports, and clinic settings. The workspace uses the LavaLust API and stores these records in MySQL.
