from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib, re
import feedparser
import httpx

@dataclass(frozen=True)
class NewsItem:
    guid: str; source: str; title: str; description: str; url: str; published_at: datetime

def clean(value: str, limit: int = 280) -> str:
    value = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", value).strip()[:limit]

async def fetch_feed(url: str, user_agent: str) -> list[NewsItem]:
    async with httpx.AsyncClient(headers={"User-Agent": user_agent}, timeout=30, follow_redirects=True) as client:
        response = await client.get(url); response.raise_for_status()
    feed = feedparser.loads(response.content)
    source = clean(feed.feed.get("title", ""), 120) or httpx.URL(url).host
    items = []
    for entry in feed.entries[:30]:
        link = entry.get("link", "")
        guid = str(entry.get("id") or hashlib.sha256(link.encode()).hexdigest())
        parsed = entry.get("published_parsed") or entry.get("updated_parsed")
        published = datetime(*parsed[:6], tzinfo=timezone.utc) if parsed else datetime.now(timezone.utc)
        items.append(NewsItem(guid, source, clean(entry.get("title", ""), 240), clean(entry.get("summary", "")), link, published))
    return [item for item in items if item.title and item.url]
