# Racecraft Analytics

เว็บวิเคราะห์ F1 เชิงลึกภาษาไทยสำหรับนักวิเคราะห์ข้อมูล ใช้ Next.js App Router และ Python worker โดยไม่มี OpenAI หรือ AI-generated copy บทสรุปข่าวมาจาก RSS และลิงก์กลับ publisher ต้นทาง ส่วนตัวเลข analytics คำนวณด้วยสูตร deterministic เท่านั้น

## เริ่มใช้งานเว็บ

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

เปิด `http://localhost:3000` หากไม่ตั้ง `DATABASE_URL` เว็บจะใช้ calendar/standings snapshot ในโค้ด และพยายามอ่าน RSS server-side ทุก 10 นาที

## Developer diagnostics

เปิด `http://localhost:3000/diagnostics` เพื่อดู Data Completeness Dashboard และใช้ `http://localhost:3000/api/diagnostics/completeness` สำหรับ JSON smoke checks. Routes นี้เปิดใน development โดยอัตโนมัติ และถูกปิดใน production เว้นแต่ตั้ง `ENABLE_DEV_DIAGNOSTICS=true`; response แสดงเฉพาะสถานะ/จำนวนข้อมูลและไม่ส่งค่า secret กลับไป

`/api/export/standings` ส่ง CSV เฉพาะข้อมูลจาก Jolpica หากเหลือเพียงข้อมูลสำรองจะตอบ `503` พร้อม `Retry-After: 600` เพื่อไม่ให้คะแนนสำรองถูกเข้าใจว่าเป็นข้อมูลล่าสุด ส่วน diagnostics จะรายงาน PostgreSQL เป็น `live` หลัง query ตรวจการเชื่อมต่อสำเร็จเท่านั้น โดยมี timeout และ cache ผลตรวจ 60 วินาที

## Worker

```powershell
cd services/ingest
py -m venv .venv
.venv\Scripts\python -m pip install -e ".[test]"
.venv\Scripts\racecraft-ingest --once
```

ตั้ง `DATABASE_URL`, PostgreSQL และ provider variables ตาม `.env.example` โดย worker ต้องมี persistent volume ที่ `/data` สำหรับ FastF1 cache และเรียก worker ทุก 10 นาที เมื่อ OpenF1 ปิดระหว่าง session worker จะรายงาน `awaiting_data` และลองใหม่ในรอบถัดไปจนกว่าจะเผยแพร่ข้อมูลหลังจบ session

หาก FastF1 ประมวลผล session ไม่สำเร็จ worker จะพักรายการนั้นอย่างน้อย 20 นาที และให้รายการที่ยังไม่เคยลองทำงานก่อน retry โดยยังลองโหลดไม่เกินหนึ่ง session ต่อรอบ สถานะ retry เก็บในหน่วยความจำและเริ่มใหม่เมื่อ worker restart; `fastf1_pending` นับ session ทั้งหมดที่ยังไม่มี artifact รุ่นปัจจุบัน

## Self-hosted Docker on Debian

Artifact รุ่น `fastf1-session-v6` เพิ่ม `distance` หน่วยเมตรจากคอลัมน์ `Distance` ของ FastF1 โดยใช้ lap ที่ผ่าน validation ชุดเดียวกันสำหรับ pace, theoretical best และ telemetry เว็บอ่านได้ทั้ง v5 และ v6 แต่ไม่อ่านรุ่นก่อน v5 หรือ artifact ที่ season/round/session ไม่ตรงกับตำแหน่งจัดเก็บ หลังอัปเดตต้อง deploy ทั้งเว็บและ worker; worker จะทยอยสร้าง v5 ใหม่เป็น v6 โดยเว็บยังแสดงแกนเวลาจาก v5 ได้ระหว่างรอ ไม่ต้องลบไฟล์เก่าเอง

กราฟ telemetry ในหน้า Drivers/Compare เลือกแกนระยะทางเป็นค่าเริ่มต้นเมื่อทุก trace ที่เลือกมีระยะทางครบและไม่ย้อนกลับ และสลับกลับแกนเวลาได้ กราฟทั้งสี่ช่องและตารางใช้แกนเดียวกัน หากระยะทางขาดหายหรือใช้ artifact เก่า ปุ่มระยะทางจะถูกปิดพร้อมคำอธิบาย เว็บไม่อินทิเกรตความเร็ว ไม่ย้ายจุดเริ่มระยะทาง และไม่ยืดแต่ละรอบให้ยาวเท่ากัน ระยะทางนี้เป็นค่าที่ FastF1 คำนวณจาก telemetry ไม่ใช่พิกัด GPS ที่รับประกันตำแหน่งเดียวกันอย่างแม่นยำ

หน้า Compare เก็บตัวกรอง `session`, `round`, `circuit` ใน URL และโหลด artifact ล่าสุดที่ตรงกับตัวกรองจาก server ใหม่ทุกครั้ง หากไม่มี artifact ตรงกันจะไม่ใช้ข้อมูลจากสนามอื่นแทน หน้าแรกใช้กราฟจาก FastF1 เท่านั้น

โปรเจกต์มี production Docker stack สำหรับ self-hosted PostgreSQL, Next.js web, FastF1 worker, Nginx และ Traefik โดย Traefik bind ที่ `127.0.0.1:3333` แล้วส่งต่อเข้า Nginx ภายใน เพื่อให้ Cloudflare Tunnel เดิมชี้ไปที่ `http://localhost:3333` ได้

```bash
cp .env.docker.example .env.docker
chmod 600 .env.docker
# แก้ค่า POSTGRES_PASSWORD, DATABASE_URL, NEXT_PUBLIC_SITE_URL และ CONTACT_EMAIL
# สร้างทีละ image เพื่อลด peak RAM ระหว่าง deploy บนเครื่อง 8GB
COMPOSE_PARALLEL_LIMIT=1 docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d --no-build
docker compose ps
curl http://127.0.0.1:3333/healthz
```

สำหรับ Debian server ที่มี RAM 8GB compose ตั้งเพดานไว้ให้แล้ว: PostgreSQL 768MB, web 512MB, FastF1 worker 2GB และ Nginx 96MB (รวมเพดานประมาณ 3.4GB) พร้อมจำกัด numerical threads ของ worker เหลือ 1 เพื่อลด CPU/RAM spike ระหว่างคำนวณ telemetry FastF1 เว็บใช้ Next.js standalone runtime จึงไม่ติดตั้ง `node_modules` ทั้งชุดใน production image หาก session ใหญ่จน worker ถูก OOM ให้เพิ่มเฉพาะ `worker.mem_limit` เป็น `3g` และตรวจ `free -h` ก่อน ไม่ควรเพิ่มทุก service พร้อมกัน

Traefik เป็น edge proxy ภายในเครื่องและปิด dashboard/access log เพื่อลด overhead; Nginx เปิด gzip, keep-alive และ response buffering; cache เฉพาะไฟล์ immutable ใน `/_next/static/` ด้วย cache ชั่วคราว 64MB บน tmpfs ไม่ cache HTML หรือ API เพื่อไม่ให้ข้อมูล race/news เก่า ส่วน Docker log จำกัดไว้ 3 ไฟล์ต่อ service เพื่อป้องกัน disk เต็ม

Migration อยู่ที่ `database/migrations/` และ Docker PostgreSQL จะรันตามลำดับชื่อไฟล์ (`0001_initial.sql`, `0002_telemetry_artifacts.sql`) เฉพาะตอนสร้าง volume ครั้งแรก หากแก้ schema ภายหลังต้องรัน migration เพิ่มเอง ห้ามเปิด port `5432` ออก Internet และควรสำรอง volume `postgres_data` ไปยังเครื่องอื่น

ถ้ามี `postgres_data` เดิมอยู่แล้ว ให้สำรองก่อน แล้วรันเฉพาะ migration ใหม่ด้วย `docker compose exec -T postgres psql -U <POSTGRES_USER> -d <POSTGRES_DB> -f /docker-entrypoint-initdb.d/0002_telemetry_artifacts.sql` โดยไม่ต้องรัน `0001_initial.sql` ซ้ำ

## Validation

ทุกหน้าใช้ข้อความสถานะโหลดเท่านั้น ไม่มี skeleton หรือ shimmer รวมทั้ง loading ของหน้า Drivers และ Suspense ในหน้า Compare/Data โดยยังคง loading boundary และข้อความที่ screen reader อ่านได้

### FastF1 real-data smoke check (opt-in)

ดาวน์โหลดเฉพาะเซสชันที่เผยแพร่แล้วผ่าน adapter ตัวเดียวกับ worker และเขียนลง directory ใหม่เท่านั้น ไม่เชื่อม PostgreSQL ไม่รัน worker loop และไม่แก้ telemetry ที่ใช้งานอยู่ ต้องติดตั้ง dependencies ของ ingest ก่อน ตัวอย่างบน Linux จาก root โปรเจกต์:

```bash
validation_dir=$(mktemp -d /tmp/racecraft-validation-XXXXXX)
PYTHONPATH=services/ingest services/ingest/.venv/bin/python scripts/validate-fastf1.py \
  --season 2024 --round 6 --session R --output "$validation_dir/miami"
FASTF1_VALIDATION_ROOT="$validation_dir/miami/artifacts" npx vitest run src/lib/fastf1-live.test.ts
```

เปลี่ยน Python path ให้ตรงกับ virtualenv ที่ติดตั้งจริง ตัวตรวจ Python ตรวจ JSON, lap alignment, telemetry และจำนวนแถว Parquet; ตัวตรวจ TypeScript อ่าน artifact จริงผ่าน server data API และตัวแปลงแกนเวลาที่กราฟใช้ พร้อมยืนยันว่าไม่เรียก provider จากขั้นตอนอ่านไฟล์ กรณี Sprint ใช้ `--session S` (เว็บรับ `SPR`) สามารถตรวจเพิ่มด้วยปี 2024 round 5 / S และ round 12 / R สำหรับกรณี Sprint และสภาพผิวสนามเปลี่ยนแห้ง–เปียก

ชุดทดสอบปกติจะ skip real-data check หากไม่ตั้ง `FASTF1_VALIDATION_ROOT` เพื่อไม่ดาวน์โหลดข้อมูลโดยไม่ตั้งใจ การตรวจนี้ไม่ครอบคลุมการ deploy, worker scheduling หรือการเชื่อม PostgreSQL/OpenF1/Jolpica จริง ข้อมูล cache, JSON และ Parquet ทดสอบต้องอยู่นอก Git

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## UI routing boundary

- Next.js App Router remains the canonical router for pages, deep links, SSR, and route-level data fetching.
- `react-router-dom` is available for isolated client-side widgets such as Compare controls, filters, and interactive labs; do not wrap the whole Next app in `BrowserRouter`.
- Tailwind CSS v4 and shadcn/ui components live under `src/app/tailwind.css` and `src/components/ui/`.

## Data policy

บทบาท provider ถูกแยกชัดเจนเพื่อไม่ให้ analytics ซ้ำซ้อน:

- Jolpica = race and championship data: calendar, race/qualifying/sprint results, standings, drivers และ constructors
- OpenF1 = session context: session timing, laps, stints, weather, race control, overtakes, positions และ car data หลัง provider เผยแพร่
- FastF1 = sole analysis engine: worker โหลด session ที่เผยแพร่แล้วและสร้าง validated artifact สำหรับ telemetry, sector delta, theoretical best, clean-lap pace, tyre degradation, stint performance, consistency และ driver/teammate comparison
- หน้า analysis ทุกหน้าจะใช้เฉพาะ FastF1 artifact; หาก artifact ยังไม่พร้อมจะแสดง `FASTF1 · PENDING` และไม่แทนค่ากราฟด้วย OpenF1
- OpenF1 ยังคงใช้เฉพาะ session context, weather, race-control และผลประกอบเมื่อ provider เผยแพร่แล้ว ไม่ถูกใช้แทน deep analysis
- OpenF1 อาจปิด endpoint ระหว่าง FP/Qualifying/Sprint/Race ระบบจะแสดง `POST-SESSION PENDING`/`awaiting_data`, ไม่ลบ snapshot เดิม และให้ worker retry รอบละ 10 นาที
- RSS: title, short description, published time และ source URL เท่านั้น
- ห้ามเรียก provider จาก browser โดยตรง; web อ่าน server snapshot หรือ FastF1 artifact จาก shared storage
- Provider failure ห้ามลบข้อมูลที่เคยเผยแพร่ และค่า `Complete` ต้องผ่าน cross-provider validation

โปรดอ่าน `RISK_ACCEPTANCE.md` และตรวจ commercial terms ของทุก provider/feed ก่อนเปิด AdSense
