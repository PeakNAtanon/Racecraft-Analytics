import { PageHead } from "@/components/shared";
import { getLocale } from "@/lib/i18n-server";
import { message } from "@/lib/i18n";

export default async function About(){const locale=await getLocale();const contactEmail=process.env.CONTACT_EMAIL?.trim() || "peaknatanon@gmail.com";return <><PageHead eyebrow="INDEPENDENT ANALYSIS" title="About">{message(locale,"aboutDescription")}</PageHead><div className="panel"><h2>Correction & takedown</h2><p>{message(locale,"correctionText")}</p><p><a className="link-arrow" href={`mailto:${contactEmail}`}>{contactEmail}</a></p></div></>}
