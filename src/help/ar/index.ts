import type { HelpTranslation } from "../translations";
import { AR_GENERAL } from "./general";
import { AR_FLOWS } from "./flows";
import { AR_COMMON } from "./common";
import { AR_CRM } from "./crm";
import { AR_SALES } from "./sales";
import { AR_PURCHASE } from "./purchase";
import { AR_INVENTORY } from "./inventory";
import { AR_DELIVERY } from "./delivery";
import { AR_INVOICE } from "./invoice";
import { AR_HR } from "./hr";
import { AR_ATTENDANCE } from "./attendance";

// The Arabic help (backlog 8.1.8): one file per menu module, mirroring src/help/topics and flows.ts by id.
// Button and field names are written as the Arabic screens show them (src/i18n/ar.ts), in «», so they can be found
// on the page; a label the screens still show in English is quoted in English.
// Check with: node scripts/check-help-arabic.cjs
export const AR_HELP: HelpTranslation = {
  topics: { ...AR_GENERAL, ...AR_COMMON, ...AR_CRM, ...AR_SALES, ...AR_PURCHASE, ...AR_INVENTORY, ...AR_DELIVERY, ...AR_INVOICE, ...AR_HR, ...AR_ATTENDANCE },
  flows: AR_FLOWS,
};
