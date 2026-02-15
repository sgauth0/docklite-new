# CONNECTNEWSITE.md

This documents how `imterminally.online` is wired up through Cloudflare -> host nginx (Certbot TLS) -> the static site root, while keeping other Docklite-managed sites (Traefik + containers) working. It also covers what changed to add the newer Web UI under `/app` and keep `/api/v1/*` working.

## Traffic Flow (Current)

1. Browser -> Cloudflare (proxied DNS / TLS termination / HTTP3)
2. Cloudflare -> origin host nginx (ports 80/443)
3. Host nginx (vhost `imterminally.online`)
   - Serves static files from `/var/www/sites/stella/imterminally.online`
   - Proxies `/api/*` to the Node backend on `http://localhost:3003`
4. Node backend (legacy Express on the host)
   - Serves legacy `/api/*`
   - Also serves compatibility `/api/v1/*` for the newer `/app` UI

## Where The Nginx Config Lives (Live)

The live host nginx vhost is:

- `/etc/nginx/sites-available/starlander` (enabled via `/etc/nginx/sites-enabled/starlander.conf`)

Key behaviors in that file:

1. Static site (including `/app`)
   - `location /` uses:
     - `root /var/www/sites/stella/imterminally.online;`
     - `try_files $uri $uri/ =404;`
   - Because `try_files` includes `$uri/`, requesting `/app` resolves as a directory and nginx will serve `/app/index.html`.

2. API proxy
   - `location /api/` proxies to the host backend:
     - `proxy_pass http://localhost:3003/api/;`
   - This keeps `/api/v1/*` working too (because Express mounts `/api/v1`).

## Site Files / New Web UI Under `/app`

Static files served by the site container live at:

- `/var/www/sites/stella/imterminally.online`

The newer Web UI is served at:

- `/var/www/sites/stella/imterminally.online/app/index.html`

Because Nginx is already configured with `try_files $uri $uri/ =404`, no extra routing was required beyond ensuring the `/app/` directory exists with an `index.html`.

## Node Backend Details

Backend source:

- `/var/www/sites/stella/imterminally.online/server`

Important mount point:

- `/var/www/sites/stella/imterminally.online/server/src/index.ts`
  - mounts `v1Routes` at `/api/v1`
  - this is required because `/app/index.html` calls endpoints like `/api/v1/auth/login`, `/api/v1/me`, `/api/v1/threads`, `/api/v1/inference/chat/stream`, etc.

## Important Stability Fix (Avoiding Intermittent 502s)

Symptom:

- Browser requests like `POST /api/v1/auth/login` intermittently returned Cloudflare `502`.

Root cause:

- Multiple PM2 instances were trying to bind the backend to the same port (e.g. `3003`), causing `EADDRINUSE` crashes and brief downtime. When Nginx/Traefik hit the backend during those windows it produced `502`.

Fix applied:

- In `/var/www/sites/stella/imterminally.online/server/src/index.ts`, the listen port is offset by `NODE_APP_INSTANCE`:
  - instance `0`: `PORT` (e.g. `3003`)
  - instance `1`: `PORT + 1` (e.g. `3004`)

This prevents port collisions and keeps `172.21.0.1:3003` stable for the Nginx upstream.

## Traefik / Containers Notes

This host also runs Docklite-managed containers and a Traefik container (`docklite_traefik`) for other domains. `imterminally.online` is *not* currently served by Traefik; it is served by host nginx directly (see `/etc/nginx/sites-available/starlander`).

There is also a Docklite site container named `docklite-site-imterminally-online` running on this box; it is not in the public request path for `imterminally.online` as configured today.

## Why This Doesn’t Break Other Sites / Containers

- Traefik continues to route other domains to their existing site containers.
- The `imterminally.online` changes are scoped to its vhost and site root.
- The backend change only affects how the Node process picks its listen port when PM2 spawns multiple instances; it does not change API paths or require Traefik/Nginx changes.
