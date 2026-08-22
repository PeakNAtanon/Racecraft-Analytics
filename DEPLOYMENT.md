# Self-hosted deployment

Racecraft runs on one Debian host with Docker Compose. The stack keeps PostgreSQL private, exposes Nginx only at `127.0.0.1:3333`, and lets the existing Cloudflare Tunnel publish the site.

## 1. Prepare the server

Install Docker Engine plus the Compose plugin, then clone the GitHub repository in a dedicated directory:

```bash
sudo mkdir -p /opt/racecraft-analytics
sudo chown "$USER":"$USER" /opt/racecraft-analytics
git clone https://github.com/PeakNAtanon/Racecraft-Analytics.git /opt/racecraft-analytics
cd /opt/racecraft-analytics
cp .env.docker.example .env.docker
chmod 600 .env.docker
nano .env.docker
```

Set a long URL-safe `POSTGRES_PASSWORD`, update the same password in `DATABASE_URL`, set `NEXT_PUBLIC_SITE_URL` to the public HTTPS URL, and keep `CONTACT_EMAIL=peaknatanon@gmail.com`.

## 2. Build and start

Build one image at a time to keep peak memory low on the 8 GB host:

```bash
COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d --no-build
docker compose --env-file .env.docker ps
curl -fsS http://127.0.0.1:3333/healthz
curl -fsS http://127.0.0.1:3333/api/health
```

Do not publish port `5432`. Compose creates the database migration schema only on the first `postgres_data` volume creation.

## 3. Route the existing Cloudflare Tunnel

Add this ingress before the catch-all rule in the existing Tunnel configuration, replacing the hostname:

```yaml
- hostname: f1.example.com
  service: http://127.0.0.1:3333
```

If the Tunnel is managed in the Cloudflare dashboard, add a Public Hostname with the same service URL instead. Then create/verify the DNS route in Cloudflare and restart the existing service only if it uses a local config:

```bash
sudo systemctl restart cloudflared
sudo systemctl status cloudflared --no-pager
curl -I https://f1.example.com
```

## 4. Update safely

```bash
cd /opt/racecraft-analytics
git pull --ff-only
COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d --no-build
docker compose --env-file .env.docker ps
```

Check logs with `docker compose logs --tail=100 web worker`. Back up the `postgres_data` volume and telemetry volume before changing database migrations or removing volumes.
