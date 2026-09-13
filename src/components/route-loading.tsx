export function RouteLoading({ label = "Loading data…" }: { label?: string }) {
  return <p className="route-loading-status" role="status" aria-live="polite" aria-busy="true">
    <span lang="en">{label}</span>
    <span lang="th">กำลังโหลดข้อมูล…</span>
  </p>;
}
