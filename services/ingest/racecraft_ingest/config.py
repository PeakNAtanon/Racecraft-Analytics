from dataclasses import dataclass
import os

@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "")
    jolpica_url: str = os.getenv("JOLPICA_BASE_URL", "https://api.jolpi.ca/ergast/f1")
    openf1_url: str = os.getenv("OPENF1_BASE_URL", "https://api.openf1.org/v1")
    rss_feeds: tuple[str, ...] = tuple(x.strip() for x in os.getenv("RSS_FEEDS", "https://www.motorsport.com/rss/f1/news/").split(",") if x.strip())
    user_agent: str = os.getenv("PROVIDER_USER_AGENT", "RacecraftAnalytics/0.1")
    season: int = int(os.getenv("F1_SEASON", "2026"))
    fastf1_cache: str = os.getenv("FASTF1_CACHE", "/data/fastf1-cache")
    telemetry_storage: str = os.getenv("TELEMETRY_STORAGE_PATH", "/data/telemetry")
    fastf1_enabled: bool = os.getenv("FASTF1_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
