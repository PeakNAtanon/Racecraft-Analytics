export type SessionCode = "FP1" | "FP2" | "FP3" | "SQ" | "SPR" | "Q" | "R";
export type DataStatus = "scheduled" | "awaiting_data" | "provisional" | "telemetry_processing" | "validating" | "complete";

export interface SessionInfo { code: SessionCode; name: string; startsAt: string; endsAt?: string; status: DataStatus; sessionKey?: number; source?: "OpenF1" | "Jolpica" | "fallback" }
export interface Circuit { id: string; name: string; locality: string; country: string; lengthKm: number; corners: number; path: string; sectorPath?: string; pathTransform?: string; startPoint?: { x: number; y: number }; builtYear?: number }
export interface Round { season: number; round: number; slug: string; name: string; raceStartsAt: string; circuit: Circuit; sessions: SessionInfo[] }
export interface Standing { position: number; code: string; name: string; team: string; points?: number; wins?: number; color?: string }
export interface DriverProfile extends Standing { driverId?: string; driverNumber?: number; nationality?: string }
export interface Metric { id: string; label: string; value: string; note: string; tone?: "red" | "cyan" | "amber" | "green" }
export interface PaceSeries { code: string; name: string; values: Array<number | null>; color?: string }
export interface PaceChartData { sessionLabel: string; source: "FastF1" | "OpenF1" | "fallback"; laps: number[]; series: PaceSeries[]; defaultCodes?: string[] }
export interface StintSnapshot { driverNumber: number; code: string; name: string; team: string; color?: string; stint: number; compound: string; startLap: number; endLap: number; lapCount: number; medianLap?: number; degradationPerLap?: number }
export type SessionResultStatus = "CLASSIFIED" | "DNF" | "DNS" | "DSQ";
export interface SessionResult { position?: number; driverNumber: number; code: string; name: string; team: string; status: SessionResultStatus; time: string; gap: string; laps?: number; grid?: number; points?: number; color?: string }
export interface CircuitStats { source: "Jolpica" | "fallback"; firstGrandPrix?: number; numberOfLaps?: number; fastestLap?: { time: string; driver: string; year?: number }; raceDistanceKm?: number }
export interface WeatherSnapshot { source: "OpenF1" | "fallback"; sessionName: string; sampledAt?: string; airTemperature?: number; trackTemperature?: number; humidity?: number; windSpeed?: number; windDirection?: number; rainfall?: boolean }
export interface FastF1DriverMetrics { validLaps?: number; cleanLapMedian?: number; bestLap?: number; consistency?: number; degradationSlope?: number; theoreticalBest?: number }
export interface SessionAnalyticsSnapshot { sessionKey?: number; sessionName: string; source: "FastF1" | "OpenF1" | "fallback"; metrics: Metric[]; driverMetrics?: Record<string, FastF1DriverMetrics>; racecraftByDriver?: Record<string, DriverRacecraftSnapshot>; pace: PaceChartData; stints: StintSnapshot[]; results: SessionResult[]; resultsSource: "OpenF1" | "Jolpica" | "fallback"; weather?: WeatherSnapshot }
export interface ComparisonSession { sessionKey: number; round: number; circuit: string; sessionCode: SessionCode; sessionName: string; startsAt: string; results: SessionResult[]; resultsSource?: "OpenF1" | "Jolpica" | "fallback" }
export interface SeasonComparisonSnapshot { season: number; source: "Jolpica" | "OpenF1" | "fallback"; drivers: Standing[]; sessions: ComparisonSession[] }
export interface DriverAnalysisSession { sessionKey: number; round: number; circuit: string; sessionCode: SessionCode; sessionName: string; startsAt: string; status: "complete" | "provisional" | "unavailable"; position?: number; grid?: number; points?: number; laps?: number; validLaps?: number; resultStatus?: SessionResultStatus; source: "OpenF1" | "Jolpica" | "fallback" }
export interface DriverAnalysisSummary { averageFinish?: number; bestFinish?: number; validSessions: number; validLaps: number; classified: number; dnf: number; dns: number; dsq: number; positionsGained?: number }
export interface DriverRacecraftSnapshot { overtakesMade?: number; overtakesLost?: number; raceControlEvents?: number; positionSamples?: number; positionsGained?: number; source: "FastF1" | "OpenF1" | "fallback" }
export interface DriverTelemetryPoint { timestamp?: string; speed?: number; throttle?: number; brake?: number; gear?: number }
export interface DriverTelemetrySnapshot { available: boolean; sampleCount: number; fields: string[]; samples: DriverTelemetryPoint[]; source: "OpenF1" | "FastF1" | "fallback" }
export interface DriverAnalysisSnapshot { season: number; driver: DriverProfile; source: "FastF1" | "OpenF1" | "Jolpica" | "fallback"; status: DataStatus; sessions: DriverAnalysisSession[]; summary: DriverAnalysisSummary; selectedSession?: DriverAnalysisSession; selectedAnalytics?: SessionAnalyticsSnapshot; racecraft?: DriverRacecraftSnapshot; telemetry?: DriverTelemetrySnapshot; teammate?: Standing }
export type NewsProvider = "Autosport" | "Motorsport.com" | "Other";
export interface NewsItem { id: string; source: string; provider: NewsProvider; title: string; description: string; url: string; publishedAt: string; imageUrl?: string }
