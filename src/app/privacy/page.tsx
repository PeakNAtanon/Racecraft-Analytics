import { PageHead } from "@/components/shared";
import { getLocale } from "@/lib/i18n-server";
import { message } from "@/lib/i18n";

export default async function Privacy(){const locale=await getLocale();return <><PageHead eyebrow="LEGAL" title="Privacy">{message(locale,"privacyDescription")}</PageHead><div className="panel"><p>{message(locale,"privacyText")}</p></div></>}
