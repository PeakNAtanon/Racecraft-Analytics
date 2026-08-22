"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState, useTransition } from "react";

export type DriverDirectorySort = "championship" | "points" | "wins" | "team";

interface DriverDirectoryControlsProps {
  season: number;
  teams: string[];
  initialSearch: string;
  initialTeam: string;
  initialSort: DriverDirectorySort;
  visibleCount: number;
  totalCount: number;
}

export function DriverDirectoryControls({ season, teams, initialSearch, initialTeam, initialSort, visibleCount, totalCount }: DriverDirectoryControlsProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [team, setTeam] = useState(initialTeam);
  const [sort, setSort] = useState<DriverDirectorySort>(initialSort);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const committedSearch = useRef(initialSearch);

  const navigate = useCallback((nextSearch: string, nextTeam: string, nextSort: DriverDirectorySort) => {
    const params = new URLSearchParams({ season: String(season), sort: nextSort });
    if (nextSearch.trim()) params.set("q", nextSearch.trim());
    if (nextTeam) params.set("team", nextTeam);
    startTransition(() => router.replace(`/drivers?${params.toString()}`, { scroll: false }));
  }, [router, season]);

  useEffect(() => {
    if (search === committedSearch.current) return;
    const timer = window.setTimeout(() => {
      committedSearch.current = search;
      navigate(search, team, sort);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [navigate, search, sort, team]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    committedSearch.current = search;
    navigate(search, team, sort);
  }

  function clearSearch() {
    setSearch("");
    committedSearch.current = "";
    navigate("", team, sort);
  }

  function reset() {
    setSearch("");
    setTeam("");
    setSort("championship");
    committedSearch.current = "";
    navigate("", "", "championship");
  }

  return <form action="/drivers" method="get" className="driver-directory-controls panel" role="search" aria-label="Filter driver analysis directory" aria-busy={isPending} onSubmit={submit}>
    <input type="hidden" name="season" value={season} />
    <div className="driver-directory-search">
      <label htmlFor="driver-search">SEARCH DRIVER</label>
      <div className="driver-search-field">
        <input id="driver-search" className="select" type="search" name="q" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, code or team" autoComplete="off" />
        {search ? <button type="button" className="driver-search-clear" onClick={clearSearch} aria-label="Clear driver search"><X size={16} aria-hidden="true" /></button> : null}
      </div>
    </div>

    <div className="driver-directory-more">
      <button type="button" className="driver-directory-filter-toggle" aria-expanded={filtersOpen} aria-controls="driver-directory-advanced" onClick={() => setFiltersOpen((value) => !value)}><SlidersHorizontal size={16} aria-hidden="true" /> FILTERS <span>{team || sort !== "championship" ? "ACTIVE" : "TEAM · SORT"}</span></button>
      <div id="driver-directory-advanced" className={`driver-directory-advanced${filtersOpen ? " is-open" : ""}`}>
        <label htmlFor="driver-team">TEAM
          <select id="driver-team" className="select" name="team" value={team} onChange={(event) => {
            const value = event.target.value;
            setTeam(value);
            navigate(search, value, sort);
          }}>
            <option value="">ALL TEAMS</option>
            {teams.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label htmlFor="driver-sort">SORT BY
          <select id="driver-sort" className="select" name="sort" value={sort} onChange={(event) => {
            const value = event.target.value as DriverDirectorySort;
            setSort(value);
            navigate(search, team, value);
          }}>
            <option value="championship">CHAMPIONSHIP</option>
            <option value="points">POINTS</option>
            <option value="wins">WINS</option>
            <option value="team">TEAM</option>
          </select>
        </label>
      </div>
    </div>

    <button className="button-secondary driver-directory-reset" type="button" onClick={reset} disabled={!search && !team && sort === "championship"}>RESET</button>
    <p className="driver-directory-count" aria-live="polite"><span>{isPending ? "UPDATING…" : "SHOWING"}</span> <b>{visibleCount}</b> OF {totalCount} DRIVERS</p>
  </form>;
}
