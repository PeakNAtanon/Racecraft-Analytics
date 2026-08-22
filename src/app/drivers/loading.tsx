export default function DriversLoading() {
  return <div className="driver-directory-page driver-directory-loading" role="status" aria-label="Loading driver analysis directory">
    <div className="driver-loading-line driver-loading-kicker" />
    <div className="driver-loading-line driver-loading-title" />
    <div className="driver-loading-line driver-loading-copy" />
    <div className="driver-loading-summary">{Array.from({ length: 4 }, (_, index) => <span key={index} />)}</div>
    <div className="driver-loading-line driver-loading-heading" />
    <div className="driver-loading-grid">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div>
    <span className="sr-only">Loading driver data…</span>
  </div>;
}
