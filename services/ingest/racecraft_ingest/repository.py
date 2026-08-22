from __future__ import annotations
from collections.abc import Iterable
from dataclasses import asdict
from datetime import datetime, timezone
import psycopg
from psycopg.types.json import Jsonb
from .providers import canonical_session_code
from .rss import NewsItem

class Repository:
    def __init__(self, database_url: str): self.database_url = database_url

    def upsert_calendar(self, season: int, payload: dict) -> int:
        races = payload.get("MRData", {}).get("RaceTable", {}).get("Races", [])
        with psycopg.connect(self.database_url) as conn, conn.cursor() as cur:
            cur.execute("insert into seasons(year,current) values(%s,true) on conflict(year) do update set current=true returning id", (season,))
            season_id = cur.fetchone()[0]
            for race in races:
                circuit = race.get("Circuit", {}); location = circuit.get("Location", {})
                slug = circuit.get("circuitId", "unknown")
                cur.execute("""insert into circuits(slug,name,country,locality,metadata) values(%s,%s,%s,%s,%s)
                    on conflict(slug) do update set name=excluded.name,country=excluded.country,locality=excluded.locality,metadata=excluded.metadata returning id""",
                    (slug,circuit.get("circuitName",slug),location.get("country"),location.get("locality"),Jsonb({"provider":"jolpica"})))
                circuit_id=cur.fetchone()[0]
                start=f"{race.get('date')}T{race.get('time','00:00:00Z')}"
                cur.execute("""insert into rounds(season_id,round,circuit_id,name,race_start,status) values(%s,%s,%s,%s,%s,'scheduled')
                    on conflict(season_id,round) do update set circuit_id=excluded.circuit_id,name=excluded.name,race_start=excluded.race_start,updated_at=now()""",
                    (season_id,int(race["round"]),circuit_id,race.get("raceName"),start))
            conn.commit()
        return len(races)

    def upsert_news(self, feed_url: str, items: Iterable[NewsItem]) -> int:
        items=list(items)
        if not items: return 0
        with psycopg.connect(self.database_url) as conn, conn.cursor() as cur:
            cur.execute("""insert into rss_sources(name,feed_url,last_fetched_at) values(%s,%s,now())
                on conflict(feed_url) do update set name=excluded.name,last_fetched_at=now() returning id""",(items[0].source,feed_url))
            source_id=cur.fetchone()[0]
            for item in items:
                data=asdict(item)
                cur.execute("""insert into news_items(source_id,guid,title,description,url,published_at) values(%s,%s,%s,%s,%s,%s)
                    on conflict(source_id,guid) do update set title=excluded.title,description=excluded.description,url=excluded.url,published_at=excluded.published_at,fetched_at=now()""",
                    (source_id,data["guid"],data["title"],data["description"],data["url"],data["published_at"]))
            conn.commit()
        return len(items)

    def upsert_sessions(self, season: int, payload: Iterable[dict]) -> int:
        """Persist normalized OpenF1 sessions without dropping unmatched rows silently."""
        rows = list(payload)
        if not rows:
            return 0

        def parse_time(value: object) -> datetime | None:
            if not value:
                return None
            try:
                parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            except ValueError:
                return None
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)
        with psycopg.connect(self.database_url) as conn, conn.cursor() as cur:
            cur.execute("select r.id, r.round, r.race_start from rounds r join seasons s on s.id=r.season_id where s.year=%s", (season,))
            rounds = [(row[0], int(row[1]), row[2]) for row in cur.fetchall()]
            accepted = 0
            for row in rows:
                code = canonical_session_code(row.get("session_name") or row.get("session_type"))
                starts_at = parse_time(row.get("date_start"))
                if code is None or starts_at is None:
                    continue
                match = min(rounds, key=lambda item: abs((item[2] - starts_at).total_seconds()), default=None)
                if match is None or abs((match[2] - starts_at).total_seconds()) > 7 * 86400:
                    continue
                ends_at = parse_time(row.get("date_end"))
                status = "scheduled" if starts_at > now else "provisional" if ends_at and ends_at > now else "complete"
                cur.execute("""insert into sessions(round_id,code,name,start_time,status,completed_at)
                    values(%s,%s,%s,%s,%s,%s)
                    on conflict(round_id,code) do update set name=excluded.name,start_time=excluded.start_time,status=excluded.status,completed_at=excluded.completed_at
                    returning id""", (match[0], code, row.get("session_name") or code, starts_at, status, ends_at if status == "complete" else None))
                session_id = cur.fetchone()[0]
                session_key = row.get("session_key")
                if session_key is not None:
                    cur.execute("""insert into provider_mappings(entity_type,entity_id,provider,provider_id,override_data)
                        values('session',%s,'openf1',%s,%s)
                        on conflict(entity_type,provider,provider_id) do update set entity_id=excluded.entity_id,override_data=excluded.override_data""",
                        (session_id, str(session_key), Jsonb({"meeting_key": row.get("meeting_key")})))
                accepted += 1
            conn.commit()
        return accepted

    def upsert_telemetry_artifact(self, season: int, round_number: int, session_code: str, storage_path: str, metadata: dict, rows_count: int | None = None, format_name: str = "json") -> int:
        """Persist FastF1 artifact metadata; the compressed files stay on the shared volume."""
        with psycopg.connect(self.database_url) as conn, conn.cursor() as cur:
            cur.execute("""select s.id from sessions s join rounds r on r.id=s.round_id join seasons y on y.id=r.season_id
                where y.year=%s and r.round=%s and s.code=%s""", (season, round_number, session_code,))
            row = cur.fetchone()
            if row is None:
                return 0
            cur.execute("""insert into telemetry_artifacts(session_id,storage_path,format,rows_count,metadata)
                values(%s,%s,%s,%s,%s)
                on conflict(storage_path) do update set session_id=excluded.session_id,rows_count=excluded.rows_count,metadata=excluded.metadata""",
                (row[0], storage_path, format_name, rows_count, Jsonb(metadata)))
            conn.commit()
        return 1
