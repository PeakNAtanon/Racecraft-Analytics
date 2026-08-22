type RouteLoadingVariant = "cards" | "news" | "table" | "dashboard" | "detail" | "article";

function LoadingHead() {
  return <div className="route-loading-head" aria-hidden="true">
    <span className="skeleton-block route-loading-kicker" />
    <span className="skeleton-block route-loading-title" />
    <span className="skeleton-block route-loading-copy" />
  </div>;
}

function LoadingMetrics({ count = 4 }: { count?: number }) {
  return <div className="route-loading-metrics" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => <span className="skeleton-block" key={index} />)}
  </div>;
}

function LoadingCards({ news = false }: { news?: boolean }) {
  return <div className={`route-loading-card-grid${news ? " is-news" : ""}`} aria-hidden="true">
    {Array.from({ length: 6 }, (_, index) => <span className="skeleton-block" key={index} />)}
  </div>;
}

function LoadingTable() {
  return <div className="route-loading-table" aria-hidden="true">
    <span className="skeleton-block route-loading-table-head" />
    {Array.from({ length: 9 }, (_, index) => <div key={index}>
      <span className="skeleton-block" />
      <span className="skeleton-block" />
      <span className="skeleton-block" />
    </div>)}
  </div>;
}

export function RouteLoading({ variant, label }: { variant: RouteLoadingVariant; label: string }) {
  return <div className={`route-skeleton route-loading route-loading-${variant}`} role="status" aria-live="polite" aria-busy="true">
    <LoadingHead />
    {variant === "cards" && <LoadingCards />}
    {variant === "news" && <><span className="skeleton-block route-loading-toolbar" aria-hidden="true" /><LoadingCards news /></>}
    {variant === "table" && <><LoadingMetrics /><LoadingTable /></>}
    {variant === "dashboard" && <><span className="skeleton-block route-loading-toolbar" aria-hidden="true" /><LoadingMetrics count={3} /><div className="route-loading-panels" aria-hidden="true"><span className="skeleton-block" /><span className="skeleton-block" /></div></>}
    {variant === "detail" && <><div className="route-loading-detail" aria-hidden="true"><span className="skeleton-block" /><span className="skeleton-block route-loading-detail-visual" /></div><LoadingMetrics /><div className="route-loading-panels" aria-hidden="true"><span className="skeleton-block" /><span className="skeleton-block" /></div></>}
    {variant === "article" && <div className="route-loading-article" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <span className="skeleton-block" key={index} />)}</div>}
    <span className="sr-only">{label}</span>
  </div>;
}
