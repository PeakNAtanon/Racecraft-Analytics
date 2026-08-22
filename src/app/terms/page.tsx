import { PageHead } from "@/components/shared";
import { getLocale } from "@/lib/i18n-server";
import { message } from "@/lib/i18n";

export default async function Terms(){const locale=await getLocale();return <><PageHead eyebrow="LEGAL" title="Terms">{message(locale,"termsDescription")}</PageHead><div className="panel"><p>{message(locale,"termsText")}</p></div></>}
