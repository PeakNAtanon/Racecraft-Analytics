import { PageHead } from "@/components/shared";
import { getLocale } from "@/lib/i18n-server";
import { message } from "@/lib/i18n";

export default async function Cookies(){const locale=await getLocale();return <><PageHead eyebrow="CONSENT" title="Cookies">{message(locale,"cookiesDescription")}</PageHead><div className="panel"><p>{message(locale,"cookiesText")}</p></div></>}
