import axios from "axios";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";

// The PDF is asked for as a blob, so an error's JSON body arrives as one too
const blobError = async (err: unknown, fallback: string) => {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try {
      const body = JSON.parse(await data.text());
      return body.message || body.error || fallback;
    } catch {
      return fallback;
    }
  }
  return apiError(err, fallback);
};

export type StatementKind = "ytd" | "pf" | "tax" | "all" | "form16";

const NAMES: Record<StatementKind, string> = { ytd: "ytd-statement", pf: "pf-statement", tax: "income-tax-statement", all: "salary-statements", form16: "form16" };

/** Downloads a salary statement as PDF (docs/PAYROLL-STATEMENTS.md): one kind, or all three in one file. */
export const downloadStatementPdf = async (kind: StatementKind, employeeId: string, fy?: string) => {
  try {
    const res = await axios.get<Blob>(`/v1/api/payroll/statements/${kind}/${employeeId}/pdf`, { params: fy ? { fy } : {}, responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${NAMES[kind]}${fy ? `-${fy}` : ""}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    ToasterService.error(await blobError(err, "The statement PDF could not be downloaded"));
  }
};
