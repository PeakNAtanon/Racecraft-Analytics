import Link from "next/link";
import { diagnosticStatusLabel, type CompletenessSnapshot, type DiagnosticCheck, type DiagnosticStatus } from "@/lib/diagnostics";
import { PageHead } from "@/components/shared";
import { DiagnosticsShortcut } from "@/components/diagnostics-shortcut";

function StatusPill({ status }: { status: DiagnosticStatus }) {
  return <span className={`diagnostic-status diagnostic-status-${status}`}><i aria-hidden="true" />{diagnosticStatusLabel(status)}</span>;
}

function ConfigurationPill({ value }: { value: CompletenessSnapshot["providers"][number]["configuration"] }) {
  return <span className={`diagnostic-config diagnostic-config-${value}`}>{value.replaceAll("_", " ")}</span>;
}

function CheckRow({ check }: { check: DiagnosticCheck }) {
  return <tr>
    <th scope="row"><span className="diagnostic-check-name">{check.label}</span><small>{check.id}</small></th>
    <td><StatusPill status={check.status} /></td>
    <td>{check.provider}</td>
    <td className="diagnostic-number">{check.records.toLocaleString("en-US")}{check.expected === undefined ? "" : ` / ${check.expected.toLocaleString("en-US")}`}</td>
    <td className="diagnostic-number">{check.coverage === undefined ? "—" : `${check.coverage}%`}</td>
    <td>{check.scope ? <><strong>{check.scope}</strong><br /></> : null}{check.reason}</td>
    <td><code>{check.endpoint}</code></td>
  </tr>;
}

export function CompletenessDashboard({ snapshot }: { snapshot: CompletenessSnapshot }) {
  const blocked = snapshot.summary.blocked;
  const session = snapshot.latestSession;
  return <div className="diagnostic-page">
    <PageHead eyebrow={`DEVELOPER TOOL · DATA COMPLETENESS · ${snapshot.season}`} title="Data diagnostics">
      ตรวจสอบความครบถ้วนของข้อมูลจาก provider, worker และ runtime configuration ใน snapshot เดียว โดยหน้านี้ไม่ได้อยู่ในเมนูผู้ใช้ทั่วไป
    </PageHead>
    <section className="diagnostic-banner" aria-label="Developer-only notice">
      <div><strong>DEVELOPER-ONLY</strong><p>Environment-gated diagnostics. Production is disabled unless <code>ENABLE_DEV_DIAGNOSTICS=true</code> is set. Values below never include secret contents.</p></div>
      <div className="diagnostic-banner-actions"><Link className="button-secondary" href="/diagnostics">Refresh snapshot</Link><DiagnosticsShortcut /><a className="button-secondary" href="/api/diagnostics/completeness" target="_blank" rel="noreferrer">Open JSON endpoint ↗</a></div>
    </section>
    <section className="diagnostic-summary-grid" aria-label="Completeness summary">
      <article><span>CHECKS</span><strong>{snapshot.summary.totalChecks}</strong><small>data + runtime</small></article>
      <article className="is-live"><span>LIVE</span><strong>{snapshot.summary.live}</strong><small>usable now</small></article>
      <article className="is-partial"><span>PARTIAL</span><strong>{snapshot.summary.partial}</strong><small>coverage below expected</small></article>
      <article className={blocked ? "is-blocked" : "is-live"}><span>BLOCKED</span><strong>{blocked}</strong><small>unavailable / pending / unconfigured</small></article>
      <article><span>RECORDS</span><strong>{snapshot.summary.totalRecords.toLocaleString("en-US")}</strong><small>provider snapshot total</small></article>
    </section>
    <section className="diagnostic-context panel">
      <div><span className="eyebrow">SNAPSHOT CONTEXT</span><h2>What was checked</h2></div>
      <dl className="diagnostic-context-list">
        <div><dt>Generated</dt><dd>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" }).format(new Date(snapshot.generatedAt))} UTC</dd></div>
        <div><dt>Environment</dt><dd>{snapshot.environment}</dd></div>
        <div><dt>Latest OpenF1 session</dt><dd>{session ? `${session.sessionKey} · ${session.sessionName} · ${session.circuit}` : "—"}</dd></div>
        <div><dt>Session start</dt><dd>{session?.startsAt ?? "—"}</dd></div>
      </dl>
    </section>
    <section className="diagnostic-provider-section">
      <div className="section-heading"><div><div className="eyebrow">PROVIDER HEALTH</div><h2>Channels at a glance</h2></div><p>CONFIGURATION IS NOT PROOF OF DATA COMPLETENESS</p></div>
      <div className="diagnostic-provider-grid">{snapshot.providers.map(provider => <article className="diagnostic-provider-card" key={provider.id}><div className="diagnostic-provider-top"><div><span className="eyebrow">{provider.id}</span><h3>{provider.label}</h3></div><ConfigurationPill value={provider.configuration} /></div><div className="diagnostic-provider-stats"><span><b>{provider.liveChecks}</b><small>LIVE</small></span><span><b>{provider.partialChecks}</b><small>PARTIAL</small></span><span><b>{provider.blockedChecks}</b><small>BLOCKED</small></span></div><code>{provider.endpoint}</code></article>)}</div>
    </section>
    <section className="diagnostic-check-section panel" id="checks">
      <div className="section-heading"><div><div className="eyebrow">FIELD-LEVEL CHECKS</div><h2>Completeness matrix</h2></div><p>RECORDS · COVERAGE · SCOPE · REASON</p></div>
      <div className="diagnostic-table-wrap"><table className="data-table diagnostic-table"><thead><tr><th scope="col">CHECK</th><th scope="col">STATUS</th><th scope="col">PROVIDER</th><th scope="col">RECORDS</th><th scope="col">COVERAGE</th><th scope="col">DIAGNOSTIC NOTE</th><th scope="col">SAFE ENDPOINT</th></tr></thead><tbody>{snapshot.checks.map(check => <CheckRow check={check} key={check.id} />)}</tbody></table></div>
    </section>
    <p className="diagnostic-footnote">This is an operational snapshot, not a historical audit. Provider outages do not delete published data. Use the JSON endpoint for automated smoke checks and keep credentials outside the response.</p>
  </div>;
}
