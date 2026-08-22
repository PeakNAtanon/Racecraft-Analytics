import { PageHead } from "@/components/shared";
import { getLocale } from "@/lib/i18n-server";
import { message } from "@/lib/i18n";

export default async function Methodology(){const locale=await getLocale();return <><PageHead eyebrow="TRANSPARENT BY DESIGN" title="Methodology">{message(locale,"methodologyDescription")}</PageHead><dl className="definition-list"><dt>Clean-lap median</dt><dd>Median of representative laps after removing pit in/out, SC/VSC, yellow-flag laps and traffic outliers.</dd><dt>Degradation slope</dt><dd>Robust linear slope of corrected lap time against tyre age within one stint.</dd><dt>Theoretical best</dt><dd>Sum of the fastest sectors for a driver in a session; it is not a real lap time.</dd><dt>Pit loss</dt><dd>Time from leaving the racing line until returning to baseline pace, including stationary time.</dd><dt>Complete</dt><dd>At least two providers agree, or the record passes the timeout and internal validation rules.</dd></dl></>}
