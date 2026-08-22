export default function Loading() {
  return <div className="route-skeleton" role="status" aria-live="polite" aria-busy="true">
    <div aria-hidden="true">
      <section className="route-skeleton-hero">
        <div className="route-skeleton-copy">
          <span className="skeleton-block skeleton-kicker" />
          <span className="skeleton-block skeleton-title skeleton-title-short" />
          <span className="skeleton-block skeleton-title" />
          <span className="skeleton-block skeleton-copy" />
          <span className="skeleton-block skeleton-copy skeleton-copy-short" />
          <span className="skeleton-block skeleton-button" />
          <div className="route-skeleton-meta">{Array.from({ length: 3 }, (_, index) => <span className="skeleton-block" key={index} />)}</div>
        </div>
        <div className="route-skeleton-track" />
        <div className="route-skeleton-rail">{Array.from({ length: 5 }, (_, index) => <span className="skeleton-block" key={index} />)}</div>
      </section>
      <div className="route-skeleton-heading"><span className="skeleton-block skeleton-kicker" /><span className="skeleton-block skeleton-section-title" /></div>
      <div className="route-skeleton-metrics">{Array.from({ length: 4 }, (_, index) => <span className="skeleton-block" key={index} />)}</div>
      <div className="route-skeleton-panels">{Array.from({ length: 2 }, (_, index) => <span className="skeleton-block" key={index} />)}</div>
    </div>
    <span className="sr-only">Loading Racecraft Analytics data…</span>
  </div>;
}
