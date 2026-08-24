# Self-hosted deployment

คู่มือนี้ใช้สำหรับ Deploy Racecraft Analytics บน Debian 13 ด้วย Docker Compose โดยเก็บ PostgreSQL ไว้ภายในเครื่อง ให้ Traefik รับที่ `127.0.0.1:3333` แล้วส่งต่อเข้า Nginx ภายใน และให้ Cloudflare Tunnel เป็นตัวเผยแพร่โดเมนสาธารณะ

Racecraft runs on one Debian host with Docker Compose. The stack keeps PostgreSQL private, exposes only Traefik at `127.0.0.1:3333`, routes internally to Nginx, and lets the existing Cloudflare Tunnel publish the site.

## 0. Install Docker on Debian 13

ถ้าเครื่องยังไม่มี Docker ให้ติดตั้ง Docker Engine จาก official repository ของ Docker:

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: trixie
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run hello-world
```

ถ้าต้องการใช้ Docker โดยไม่พิมพ์ `sudo` ให้เพิ่ม user ปัจจุบันเข้า group แล้ว login ใหม่:

```bash
sudo usermod -aG docker "$USER"
```

สมาชิก `docker` group มีสิทธิ์ระดับ root บนเครื่อง ควรทำเฉพาะกับ user ที่เชื่อถือได้ และไม่ต้องติดตั้ง Docker Desktop บน Debian server

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

Traefik owns the host bind on `127.0.0.1:3333` and forwards requests to the internal Nginx service. Nginx reuses upstream connections, compresses text responses, and caches only hashed Next.js static assets in a bounded 64 MB tmpfs. HTML and `/api/*` remain uncached. Neither proxy exposes a dashboard or Docker socket. Container logs are rotated automatically; inspect recent output with `docker compose --env-file .env.docker logs --tail=100 traefik nginx web worker`.

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

Check logs with `docker compose logs --tail=100 traefik nginx web worker`. Back up the `postgres_data` volume and telemetry volume before changing database migrations or removing volumes.

## Redis cache

The Compose stack includes Redis as a disposable L2 cache. It is capped at 128 MB (Redis `maxmemory` 96 MB), uses `allkeys-lru`, and has no volume because cached data can be rebuilt. Set `REDIS_URL=redis://redis:6379` in `.env.docker`; the web service waits for Redis health before starting. If Redis is unavailable later, the web layer falls back to its in-process cache.

The cache covers provider responses, schedule, RSS news and DataHub snapshots for 10 minutes. Redis is internal-only and is not published to the host.
