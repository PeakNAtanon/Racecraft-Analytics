import { PageHead } from "@/components/shared";
import { getLocale } from "@/lib/i18n-server";
import { message } from "@/lib/i18n";

export default async function About(){const locale=await getLocale();return <><PageHead eyebrow="INDEPENDENT ANALYSIS" title="About">{message(locale,"aboutDescription")}</PageHead><div className="panel"><h2>Correction & takedown</h2><p>{message(locale,"correctionText")}</p></div></>}
