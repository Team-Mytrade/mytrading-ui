import { t } from "../../i18n/i18n";

// The employee document types the payroll service accepts (DocumentType.java), in the order HR picks them
export const EMPLOYEE_DOCUMENT_TYPES: { value: string; label: string }[] = [
    { value: "PASSPORT", label: "Passport" },
    { value: "VISA", label: "Residence Visa" },
    { value: "EMIRATES_ID", label: "Emirates ID" },
    { value: "IQAMA", label: "Iqama" },
    { value: "RESIDENCE_ID", label: "Residence ID (other)" },
    { value: "LABOUR_CARD", label: "Labour Card" },
    { value: "WORK_PERMIT", label: "Work Permit" },
    { value: "HEALTH_CARD", label: "Health Card" },
    { value: "DRIVER_LICENSE", label: "Driving Licence" },
    { value: "NATIONAL_ID", label: "National ID" },
    { value: "PAN", label: "PAN Card" },
    { value: "AADHAAR", label: "Aadhaar Card" },
    { value: "BIRTH_CERTIFICATE", label: "Birth Certificate" },
    { value: "SOCIAL_SECURITY", label: "Social Security" },
    { value: "TAX_ID", label: "Tax ID" },
    { value: "OTHER", label: "Other Document" },
];

/** A document type's name in the user's language. */
export const documentTypeLabel = (type?: string | null) =>
    t(EMPLOYEE_DOCUMENT_TYPES.find((d) => d.value === type)?.label ?? type ?? "");
