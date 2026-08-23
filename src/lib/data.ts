import { Round, Standing, NewsItem, NewsProvider } from "./types";
import { circuitPaths } from "./circuit-paths";
import { referenceCircuitPaths } from "./circuit-reference-paths";

const circuits = [
  ["albert-park", "Albert Park", "Melbourne", "Australia", 5.278, 14],
  ["shanghai", "Shanghai International Circuit", "Shanghai", "China", 5.451, 16],
  ["suzuka", "Suzuka Circuit", "Suzuka", "Japan", 5.807, 18],
  ["miami", "Miami International Autodrome", "Miami", "USA", 5.412, 19],
  ["villeneuve", "Circuit Gilles-Villeneuve", "Montréal", "Canada", 4.361, 14],
  ["monaco", "Circuit de Monaco", "Monte Carlo", "Monaco", 3.337, 19],
  ["catalunya", "Circuit de Barcelona-Catalunya", "Barcelona", "Spain", 4.657, 14],
  ["red-bull-ring", "Red Bull Ring", "Spielberg", "Austria", 4.318, 10],
  ["silverstone", "Silverstone Circuit", "Silverstone", "UK", 5.891, 18],
  ["spa", "Circuit de Spa-Francorchamps", "Stavelot", "Belgium", 7.004, 19],
  ["hungaroring", "Hungaroring", "Budapest", "Hungary", 4.381, 14],
  ["zandvoort", "Circuit Zandvoort", "Zandvoort", "Netherlands", 4.259, 14],
  ["monza", "Autodromo Nazionale Monza", "Monza", "Italy", 5.793, 11],
  ["madring", "Madring", "Madrid", "Spain", 5.474, 22],
  ["baku", "Baku City Circuit", "Baku", "Azerbaijan", 6.003, 20],
  ["sepang", "Sepang International Circuit", "Sepang", "Malaysia", 5.543, 15],
  ["marina-bay", "Marina Bay Street Circuit", "Singapore", "Singapore", 4.94, 19],
  ["americas", "Circuit of the Americas", "Austin", "USA", 5.513, 20],
  ["rodriguez", "Autódromo Hermanos Rodríguez", "Mexico City", "Mexico", 4.304, 17],
  ["interlagos", "Autódromo José Carlos Pace", "São Paulo", "Brazil", 4.309, 15],
  ["vegas", "Las Vegas Strip Circuit", "Las Vegas", "USA", 6.201, 17],
  ["losail", "Lusail International Circuit", "Lusail", "Qatar", 5.419, 16],
  ["yas-marina", "Yas Marina Circuit", "Abu Dhabi", "UAE", 5.281, 16],
] as const;

const circuitBuiltYears: Record<string, number> = { madring: 2026 };

const races = [
  ["Australian Grand Prix", "2026-03-08T04:00:00Z"], ["Chinese Grand Prix", "2026-03-15T07:00:00Z"],
  ["Japanese Grand Prix", "2026-03-29T05:00:00Z"], ["Miami Grand Prix", "2026-05-03T20:00:00Z"],
  ["Canadian Grand Prix", "2026-05-24T20:00:00Z"], ["Monaco Grand Prix", "2026-06-07T13:00:00Z"],
  ["Barcelona Grand Prix", "2026-06-14T13:00:00Z"], ["Austrian Grand Prix", "2026-06-28T13:00:00Z"],
  ["British Grand Prix", "2026-07-05T14:00:00Z"], ["Belgian Grand Prix", "2026-07-19T13:00:00Z"],
  ["Hungarian Grand Prix", "2026-07-26T13:00:00Z"], ["Dutch Grand Prix", "2026-08-23T13:00:00Z"],
  ["Italian Grand Prix", "2026-09-06T13:00:00Z"], ["Spanish Grand Prix", "2026-09-13T13:00:00Z"],
  ["Azerbaijan Grand Prix", "2026-09-26T11:00:00Z"], ["Bahrain Grand Prix in Malaysia", "2026-10-04T07:00:00Z"],
  ["Singapore Grand Prix", "2026-10-11T12:00:00Z"], ["United States Grand Prix", "2026-10-25T20:00:00Z"],
  ["Mexico City Grand Prix", "2026-11-01T20:00:00Z"], ["São Paulo Grand Prix", "2026-11-08T17:00:00Z"],
  ["Las Vegas Grand Prix", "2026-11-22T04:00:00Z"], ["Qatar Grand Prix", "2026-11-29T16:00:00Z"],
  ["Abu Dhabi Grand Prix", "2026-12-06T13:00:00Z"],
] as const;

const trackPaths = [
  "M18 75 C30 24 64 15 95 36 C122 54 152 40 169 19 C180 54 166 88 132 91 C102 94 81 73 59 90 C42 103 24 96 18 75 Z",
  "M20 80 C45 94 68 87 72 61 C76 35 97 21 123 25 C158 31 175 52 162 76 C151 97 119 91 106 72 C93 52 75 67 60 80 C46 92 31 92 20 80 Z",
  "M19 69 C42 42 67 49 79 20 C92 49 114 55 139 39 C168 21 179 47 159 66 C140 84 122 72 101 88 C76 108 41 99 19 69 Z",
];

// Red Bull Ring centerline normalized from bacinger/f1-circuits GeoJSON (MIT).
// Keep this override in the shared circuit model so list cards and detail pages
// cannot drift back to the old placeholder or the mismatched reference layout.
const circuitPathOverrides: Record<string, { path: string; startPoint: { x: number; y: number } }> = {
  "red-bull-ring": {
    // Rounded quadratic corners preserve the verified centerline while avoiding
    // the sharp polygon look of the source GeoJSON at the small card scale.
    path: "M 114.07 117.51 L 89.34 124.63 Q 81.1 127 76.38 119.39 L 62.22 96.56 Q 57.5 88.95 53.47 80.3 L 41.38 54.34 Q 37.35 45.69 32.49 39.62 L 17.92 21.41 Q 13.06 15.34 18.05 14.89 L 33.02 13.53 Q 38.01 13.08 53.6 15.29 L 100.35 21.91 Q 115.94 24.12 116.13 25.44 L 116.68 29.38 Q 116.87 30.7 114.49 33.15 L 107.37 40.51 Q 104.99 42.96 103.01 43.49 L 97.06 45.08 Q 95.08 45.61 89.26 44.87 L 71.81 42.64 Q 65.99 41.9 64.78 42.79 L 61.17 45.47 Q 59.96 46.36 59.67 48.39 L 58.78 54.47 Q 58.49 56.5 60.65 60.8 L 67.11 73.68 Q 69.27 77.98 70.77 78.92 L 75.26 81.74 Q 76.76 82.68 82.19 79.21 L 98.5 68.82 Q 103.93 65.35 115.93 65.08 L 151.94 64.25 Q 163.94 63.98 165.22 64.99 L 169.04 68.04 Q 170.32 69.05 171.66 73.8 L 175.66 88.05 Q 177 92.8 174.45 94.69 L 166.79 100.37 Q 164.24 102.26 155.85 104.84 L 130.7 112.56 Q 122.31 115.14 114.07 117.51 Z",
    startPoint: { x: 114.07, y: 117.51 },
  },
};

// Keep the Red Bull Ring sector as an explicit, continuous path. Its centerline
// folds back near the start, so a CSS dash over the closed path looks broken
// even when the dash length is technically correct.
const circuitSectorPathOverrides: Record<string, string> = {
  "red-bull-ring": "M 114.07 117.51 L 89.34 124.63 Q 81.1 127 76.38 119.39 L 62.22 96.56 Q 57.5 88.95 55.55 84.76",
};

// The reference SVGs are already oriented to match the current circuit layouts,
// but their source bounds are left-aligned in the shared 190 x 140 viewport.
// These offsets were measured after applying each reference transform. Keep
// the correction here, next to the shared round model, so cards and detail
// pages always render the same centered geometry and marker.
const circuitCenteringOffsets: Record<string, { x: number; y: number }> = {
  "albert-park": { x: 37.313, y: -0.006 },
  shanghai: { x: 22.394, y: -0.003 },
  suzuka: { x: 0.010, y: 11.320 },
  miami: { x: -0.003, y: 27.104 },
  villeneuve: { x: 65.563, y: -0.005 },
  monaco: { x: 40.912, y: -0.002 },
  catalunya: { x: 36.668, y: 0.010 },
  silverstone: { x: 49.505, y: -0.014 },
  spa: { x: 48.626, y: 0.006 },
  hungaroring: { x: 33.558, y: -0.001 },
  zandvoort: { x: 17.042, y: -0.006 },
  monza: { x: 51.387, y: -0.010 },
  madring: { x: -0.010, y: 6.536 },
  baku: { x: 32.446, y: -0.006 },
  sepang: { x: 19.037, y: -0.011 },
  "marina-bay": { x: 0.001, y: 2.867 },
  americas: { x: 26.124, y: -0.005 },
  rodriguez: { x: 8.405, y: -0.015 },
  interlagos: { x: -0.008, y: 3.842 },
  vegas: { x: -0.007, y: 5.466 },
  losail: { x: 2.448, y: 0.010 },
  "yas-marina": { x: 57.403, y: -0.011 },
};

function centeredCircuitTransform(id: string, transform: string | undefined) {
  const offset = circuitCenteringOffsets[id];
  return offset && transform ? `translate(${offset.x} ${offset.y}) ${transform}` : transform;
}

function isUsableCircuitPath(path: string | undefined) {
  const coordinates = path?.match(/-?\d+(?:\.\d+)?/g) ?? [];
  return new Set(coordinates).size >= 8;
}

function chooseCircuitPath(id: string, index: number) {
  const override = circuitPathOverrides[id];
  if (override) return override.path;
  const reference = referenceCircuitPaths[id];
  if (reference) return reference.path.replace(/^m/, "M");
  const generated = circuitPaths[id];
  if (isUsableCircuitPath(generated)) return generated;
  return trackPaths[index % trackPaths.length];
}

export const rounds: Round[] = races.map(([name, raceStartsAt], index) => {
  const [id, circuitName, locality, country, lengthKm, corners] = circuits[index];
  const override = circuitPathOverrides[id];
  const reference = referenceCircuitPaths[id];
  const offset = circuitCenteringOffsets[id];
  const race = new Date(raceStartsAt);
  const mk = (days: number, code: SessionInfoCode, sessionName: string) => ({ code, name: sessionName, startsAt: new Date(race.getTime() - days * 86400000).toISOString(), status: statusFor(new Date(race.getTime() - days * 86400000)) });
  return { season: 2026, round: index + 1, slug: id, name, raceStartsAt, circuit: { id, name: circuitName, locality, country, lengthKm, corners, path: chooseCircuitPath(id, index), sectorPath: circuitSectorPathOverrides[id], pathTransform: override ? undefined : centeredCircuitTransform(id, reference?.transform), startPoint: override?.startPoint ?? (reference?.startPoint && offset ? { x: reference.startPoint.x + offset.x, y: reference.startPoint.y + offset.y } : reference?.startPoint), builtYear: circuitBuiltYears[id] }, sessions: [mk(2, "FP1", "Free Practice 1"), mk(1.7, "FP2", "Free Practice 2"), mk(1, "FP3", "Free Practice 3"), mk(.7, "Q", "Qualifying"), mk(0, "R", "Race")] };
});
type SessionInfoCode = "FP1" | "FP2" | "FP3" | "Q" | "R";
function statusFor(date: Date) { return date.getTime() < Date.now() - 7200000 ? "complete" as const : date.getTime() < Date.now() ? "provisional" as const : "scheduled" as const; }

export function currentRound(now = new Date()): Round {
  return rounds.find((round) => now.getTime() <= new Date(round.raceStartsAt).getTime() + 48 * 3600000) ?? rounds[rounds.length - 1];
}
export function getRound(value: string) { return rounds.find((item) => item.round === Number(value) || item.slug === value); }

export const standings: Standing[] = [
  [1, "ANT", "Andrea Kimi Antonelli", "Mercedes", 219, 6], [2, "HAM", "Lewis Hamilton", "Ferrari", 169, 1],
  [3, "RUS", "George Russell", "Mercedes", 160, 2], [4, "LEC", "Charles Leclerc", "Ferrari", 138, 1],
  [5, "NOR", "Lando Norris", "McLaren", 128, 1], [6, "VER", "Max Verstappen", "Red Bull", 109, 0],
  [7, "PIA", "Oscar Piastri", "McLaren", 92, 0], [8, "HAD", "Isack Hadjar", "Red Bull", 68, 0],
  [9, "LAW", "Liam Lawson", "RB F1 Team", 43, 0], [10, "GAS", "Pierre Gasly", "Alpine F1 Team", 42, 0],
  [11, "LIN", "Arvid Lindblad", "RB F1 Team", 23, 0], [12, "COL", "Franco Colapinto", "Alpine F1 Team", 19, 0],
  [13, "BEA", "Oliver Bearman", "Haas F1 Team", 18, 0], [14, "BOR", "Gabriel Bortoleto", "Audi", 10, 0],
  [15, "SAI", "Carlos Sainz", "Williams", 6, 0], [16, "ALB", "Alexander Albon", "Williams", 5, 0],
  [17, "OCO", "Esteban Ocon", "Haas F1 Team", 3, 0], [18, "HUL", "Nico Hülkenberg", "Audi", 2, 0],
  [19, "ALO", "Fernando Alonso", "Aston Martin", 1, 0], [20, "STR", "Lance Stroll", "Aston Martin", 0, 0],
  [21, "BOT", "Valtteri Bottas", "Cadillac F1 Team", 0, 0], [22, "PER", "Sergio Pérez", "Cadillac F1 Team", 0, 0],
].map(([position, code, name, team, points, wins]) => ({ position: position as number, code: code as string, name: name as string, team: team as string, points: points as number, wins: wins as number }));

export const fallbackMetrics = [
  { id: "pace.clean_median", label: "Clean-lap median", value: "—", note: "รอ FastF1 validated artifact", tone: "cyan" as const },
  { id: "pace.session_best", label: "Session best lap", value: "—", note: "ยังไม่มี FastF1 lap ที่ผ่าน validation", tone: "green" as const },
  { id: "strategy.pit_lane", label: "Pit-lane duration", value: "—", note: "รอ FastF1 stint analysis", tone: "red" as const },
  { id: "weather.track_temp", label: "Track temperature", value: "—", note: "รอ FastF1 session artifact", tone: "amber" as const },
];

export const newsFallback: NewsItem[] = [];

function decodeXml(value:string){return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\s+/g," ").trim()}
function tag(block:string,name:string){return block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i"))?.[1]??""}
function imageUrl(value:string){try{const url=new URL(decodeXml(value));return url.protocol==="http:"||url.protocol==="https:"?url.toString():undefined}catch{return undefined}}
function newsProvider(feed:string):NewsProvider{const value=feed.toLowerCase();return value.includes("autosport")?"Autosport":value.includes("motorsport")?"Motorsport.com":"Other"}
function rssImage(block:string){
  const candidates=[
    block.match(/<(?:media:)?(?:content|thumbnail)\b[^>]*\burl=["']([^"']+)["']/i)?.[1],
    block.match(/<enclosure\b[^>]*\burl=["']([^"']+)["']/i)?.[1],
    tag(block,"image").match(/<url[^>]*>([\s\S]*?)<\/url>/i)?.[1],
    tag(block,"content:encoded").match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1],
  ];
  return candidates.map(value=>value?imageUrl(value):undefined).find(Boolean);
}
function normalizedNewsTitle(value:string){return decodeXml(value).toLowerCase().replace(/https?:\/\/\S+/g," ").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim()}
function newsPriority(provider:NewsProvider){return provider==="Autosport"?0:provider==="Motorsport.com"?1:2}
function sameNewsStory(left:NewsItem,right:NewsItem){
  const a=normalizedNewsTitle(left.title);const b=normalizedNewsTitle(right.title);
  if(!a||!b)return false;if(a===b)return true;
  const aTokens=new Set(a.split(" ").filter(token=>token.length>2));const bTokens=new Set(b.split(" ").filter(token=>token.length>2));
  if(aTokens.size<5||bTokens.size<5)return false;
  const overlap=[...aTokens].filter(token=>bTokens.has(token)).length/Math.min(aTokens.size,bTokens.size);
  return overlap>=0.86;
}
export function deduplicateNews(items:NewsItem[]){
  const ordered=[...items].sort((a,b)=>newsPriority(a.provider)-newsPriority(b.provider)||Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
  const unique:NewsItem[]=[];
  for(const item of ordered){const duplicateIndex=unique.findIndex(existing=>sameNewsStory(existing,item));if(duplicateIndex===-1)unique.push(item);else if(newsPriority(item.provider)<newsPriority(unique[duplicateIndex].provider))unique[duplicateIndex]=item;}
  return unique.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,12);
}
const newsCache = new Map<string, { expiresAt: number; value: NewsItem[] }>();
const newsInFlight = new Map<string, Promise<NewsItem[]>>();

async function loadNews(feeds: string[]) {
  const settled = await Promise.allSettled(feeds.map(async feed => {
    const response = await fetch(feed, {
      headers: { "User-Agent": process.env.PROVIDER_USER_AGENT ?? "RacecraftAnalytics/0.1" },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`RSS ${response.status}`);
    const xml = await response.text();
    const source = decodeXml(tag(xml, "title")) || new URL(feed).hostname;
    const provider = newsProvider(feed);
    return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)]
      .slice(0, 8)
      .map((match, index) => {
        const block = match[1];
        const url = decodeXml(tag(block, "link"));
        const image = rssImage(block);
        return {
          id: decodeXml(tag(block, "guid")) || `${feed}-${index}`,
          source,
          provider,
          title: decodeXml(tag(block, "title")),
          description: decodeXml(tag(block, "description")).slice(0, 260),
          url,
          publishedAt: new Date(decodeXml(tag(block, "pubDate")) || Date.now()).toISOString(),
          ...(image ? { imageUrl: image } : {}),
        };
      })
      .filter(item => item.title && item.url);
  }));
  return deduplicateNews(settled.flatMap(result => result.status === "fulfilled" ? result.value : []));
}

export async function getNews(): Promise<NewsItem[]> {
  const defaultFeeds = ["https://www.autosport.com/rss/f1/news/", "https://www.motorsport.com/rss/f1/news/"];
  const feeds = [...new Set([...(process.env.RSS_FEEDS ?? "").split(","), ...defaultFeeds].map(value => value.trim()).filter(Boolean))];
  const cacheKey = feeds.join(",");
  const cached = newsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const active = newsInFlight.get(cacheKey);
  if (active) return active;
  const request = loadNews(feeds).then(value => {
    newsCache.set(cacheKey, { expiresAt: Date.now() + 600_000, value });
    return value;
  }).finally(() => {
    if (newsInFlight.get(cacheKey) === request) newsInFlight.delete(cacheKey);
  });
  newsInFlight.set(cacheKey, request);
  return request;
}
