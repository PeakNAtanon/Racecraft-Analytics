from __future__ import annotations
import asyncio
from dataclasses import dataclass
from typing import Any
import httpx

SESSION_ALIASES = {
    "fp1": "FP1", "practice 1": "FP1", "practice1": "FP1", "free practice 1": "FP1",
    "fp2": "FP2", "practice 2": "FP2", "practice2": "FP2", "free practice 2": "FP2",
    "fp3": "FP3", "practice 3": "FP3", "practice3": "FP3", "free practice 3": "FP3",
    "sq": "SQ", "sprint qualifying": "SQ", "sprint shootout": "SQ", "sprint shoot-out": "SQ",
    "spr": "SPR", "sprint": "SPR", "q": "Q", "qualifying": "Q", "r": "R", "race": "R",
}

def canonical_session_code(value: Any) -> str | None:
    normalized = " ".join(str(value or "").strip().lower().split())
    return SESSION_ALIASES.get(normalized)

@dataclass
class ProviderResult:
    provider: str
    records: list[dict[str, Any]]
    raw: Any

class JsonProvider:
    def __init__(self, name: str, base_url: str, user_agent: str, requests_per_second: float = 4):
        self.name, self.base_url = name, base_url.rstrip("/")
        self.headers = {"User-Agent": user_agent}
        self.delay = 1 / requests_per_second

    async def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        error: Exception | None = None
        async with httpx.AsyncClient(headers=self.headers, timeout=30) as client:
            for attempt in range(4):
                try:
                    response = await client.get(f"{self.base_url}/{path.lstrip('/')}", params=params)
                    response.raise_for_status()
                    await asyncio.sleep(self.delay)
                    return response.json()
                except (httpx.HTTPError, ValueError) as exc:
                    error = exc
                    await asyncio.sleep(min(2 ** attempt, 8))
        raise RuntimeError(f"{self.name} unavailable after retries") from error

class JolpicaProvider(JsonProvider):
    def __init__(self, base_url: str, user_agent: str): super().__init__("jolpica", base_url, user_agent, 4)
    async def calendar(self, season: int): return await self.get(f"{season}.json")
    async def standings(self, season: int): return await self.get(f"{season}/driverstandings.json")

class OpenF1Provider(JsonProvider):
    def __init__(self, base_url: str, user_agent: str): super().__init__("openf1", base_url, user_agent, 3)
    async def sessions(self, year: int): return await self.get("sessions", {"year": year})
    async def laps(self, session_key: int): return await self.get("laps", {"session_key": session_key})
