import { useMemo, useState } from "react";
import { ArrowDownTrayIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { jsPDF } from "jspdf";
import autoTable, { RowInput, UserOptions } from "jspdf-autotable";
import { ToasterService } from "../../Services/ToasterService";
import { FloatingDateRangePicker } from "../inputfeild/FloatingInput";

type Primitive = string | number | boolean | null | undefined | Date;
type ExportRangePreset = "all" | "1m" | "3m" | "6m" | "custom";

export type PdfExportColumn<T extends object> = {
  key?: keyof T | string;
  header: string;
  accessor?: (row: T, index: number) => Primitive;
  align?: "left" | "center" | "right";
  width?: number;
};

export type PdfExportMeta = {
  label: string;
  value: Primitive;
};

export type ListingPdfOptions<T extends object> = {
  title: string;
  data: T[];
  columns?: PdfExportColumn<T>[];
  fileName?: string;
  subtitle?: string;
  companyName?: string;
  generatedBy?: string;
  logoSrc?: string;
  reportLabel?: string;
  metadata?: PdfExportMeta[];
  orientation?: "portrait" | "landscape";
  includeSerialNumber?: boolean;
  emptyMessage?: string;
};

export type ListingPdfExportButtonProps<T extends object> = Omit<
  ListingPdfOptions<T>,
  "data" | "metadata"
> & {
  data: T[];
  disabled?: boolean;
  buttonLabel?: string;
  buttonClassName?: string;
  metadata?: PdfExportMeta[] | ((rows: T[], rangeLabel: string) => PdfExportMeta[]);
  dateAccessor?: (row: T) => Primitive;
};

const BRAND = {
  primary: [8, 145, 178] as [number, number, number],
  primaryDark: [14, 116, 144] as [number, number, number],
  ink: [15, 23, 42] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  surface: [248, 250, 252] as [number, number, number],
};

const toTitle = (value: string) =>
  value
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

const formatValue = (value: Primitive): string => {
  if (value == null || value === "") return "-";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const fileSafe = (value: string) =>
  value
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPastDate = (months: number) => {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
};

const inferDateValue = <T extends object>(row: T): Date | null => {
  const record = row as Record<string, unknown>;
  const keys = [
    "createdAt",
    "createdDate",
    "updatedAt",
    "modifiedAt",
    "date",
    "orderDate",
    "quotationDate",
    "targetDate",
    "period",
    "scheduledDate",
    "refundDate",
    "returnDate",
    "requestedDate",
    "timestamp",
  ];

  for (const key of keys) {
    const value = record[key];
    if (!value) continue;
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
};

const normalizeExportDate = (value: Primitive) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const getAutoColumns = <T extends object>(
  data: T[]
): PdfExportColumn<T>[] => {
  const firstRow = (data[0] ?? {}) as Record<string, unknown>;
  return Object.keys(firstRow)
    .filter((key) => !["actions", "password", "token"].includes(key.toLowerCase()))
    .map((key) => ({
      key,
      header: toTitle(key),
    }));
};

const getColumnValue = <T extends object>(
  row: T,
  column: PdfExportColumn<T>,
  index: number
) => {
  if (column.accessor) return column.accessor(row, index);
  if (!column.key) return "";
  return (row as Record<string, unknown>)[String(column.key)] as Primitive;
};

const getStoredUserName = () => {
  if (typeof window === "undefined") return "My Trading";

  try {
    const user = JSON.parse(window.localStorage.getItem("user") || "null");
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    return user?.fullName || fullName || user?.name || user?.username || "My Trading";
  } catch {
    return "My Trading";
  }
};

const getFilterSummary = (metadata?: PdfExportMeta[]) => {
  if (!metadata?.length) return "";

  const rangeItem = metadata.find((item) => item.label.toLowerCase() === "range");
  const otherItems = metadata.filter((item) => item.label.toLowerCase() !== "range");
  const rangeValue = rangeItem ? formatValue(rangeItem.value) : "";
  const rangeText =
    !rangeValue || rangeValue.toLowerCase() === "all records"
      ? "Date range: No range added, all report"
      : rangeValue.includes(" to ")
        ? `Date range: From ${rangeValue.split(" to ")[0]} to ${rangeValue.split(" to ")[1]}`
        : `Date range: ${rangeValue}`;
  const otherText = otherItems
    .map((item) => `${item.label}: ${formatValue(item.value)}`)
    .join(" | ");

  return [rangeText, otherText].filter(Boolean).join(" | ");
};

const loadImageAsDataUrl = (src: string) => {
  if (typeof window === "undefined") return Promise.resolve<string | null>(null);

  return new Promise<string | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        resolve(null);
        return;
      }

      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
};

const drawHeader = <T extends object>(
  doc: jsPDF,
  options: Required<Pick<ListingPdfOptions<T>, "title" | "companyName" | "reportLabel">> &
    Pick<ListingPdfOptions<T>, "subtitle" | "metadata">,
  pageWidth: number,
  logoDataUrl?: string | null
) => {
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, pageWidth, 14, "F");

  if (logoDataUrl) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, 2, 38, 10, 2, 2, "F");
    doc.addImage(logoDataUrl, "PNG", 16, 3.1, 34, 7.8);
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(options.companyName, 14, 9.2);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(options.reportLabel, pageWidth - 14, 9.2, { align: "right" });

  doc.setTextColor(...BRAND.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(options.title, 14, 26);

  if (options.subtitle) {
    doc.setTextColor(...BRAND.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(options.subtitle, 14, 32);
  }

  const generated = `Generated ${new Date().toLocaleString()}`;
  doc.setTextColor(...BRAND.muted);
  doc.setFontSize(8);
  doc.text(generated, pageWidth - 14, 26, { align: "right" });

  const filterSummary = getFilterSummary(options.metadata);
  if (filterSummary) {
    const y = options.subtitle ? 40 : 36;
    doc.setTextColor(...BRAND.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(filterSummary, 14, y, { maxWidth: pageWidth - 28 });
  }
};

const drawFooter = (
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  generatedBy: string
) => {
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...BRAND.border);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.setTextColor(...BRAND.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Generated by ${generatedBy}`, 14, pageHeight - 7);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - 14, pageHeight - 7, {
      align: "right",
    });
  }
};

export function exportListingPdf<T extends object>({
  title,
  data,
  columns,
  fileName,
  subtitle,
  companyName = "My Trading",
  generatedBy = getStoredUserName(),
  logoSrc = "/images/logo/logo.png",
  reportLabel = "Listing Export",
  metadata = [],
  orientation = "landscape",
  includeSerialNumber = true,
  emptyMessage = "No records available",
}: ListingPdfOptions<T>) {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const exportColumns = columns?.length ? columns : getAutoColumns(data);

  const head = [
    [
      ...(includeSerialNumber ? ["#"] : []),
      ...exportColumns.map((column) => column.header),
    ],
  ];

  const body: RowInput[] =
    data.length > 0
      ? data.map((row, index) => [
          ...(includeSerialNumber ? [String(index + 1)] : []),
          ...exportColumns.map((column) => formatValue(getColumnValue(row, column, index))),
        ])
      : [[emptyMessage]];

  const startY = metadata.length ? (subtitle ? 46 : 42) : subtitle ? 38 : 34;

  return loadImageAsDataUrl(logoSrc).then((logoDataUrl) => {
    drawHeader(
    doc,
    { title, subtitle, companyName, reportLabel, metadata },
      pageWidth,
      logoDataUrl
    );

    const columnStyles: UserOptions["columnStyles"] = {};
    exportColumns.forEach((column, index) => {
      columnStyles[(includeSerialNumber ? index + 1 : index).toString()] = {
        halign: column.align ?? "left",
        cellWidth: column.width,
      };
    });

    if (includeSerialNumber) {
      columnStyles["0"] = { halign: "center", cellWidth: 10 };
    }

    autoTable(doc, {
      head,
      body,
      startY,
      margin: { left: 14, right: 14, bottom: 18 },
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: { top: 2.4, right: 2.6, bottom: 2.4, left: 2.6 },
        overflow: "linebreak",
        valign: "middle",
        lineColor: BRAND.border,
        lineWidth: 0.1,
        textColor: BRAND.ink,
      },
      headStyles: {
        fillColor: BRAND.primaryDark,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "left",
      },
      alternateRowStyles: {
        fillColor: BRAND.surface,
      },
      columnStyles,
      didDrawPage: () => {
        drawHeader(
          doc,
          { title, subtitle, companyName, reportLabel, metadata },
          pageWidth,
          logoDataUrl
        );
      },
    });

    drawFooter(doc, pageWidth, pageHeight, generatedBy);

    doc.save(`${fileSafe(fileName || title)}_${new Date().toISOString().slice(0, 10)}.pdf`);
  });
}

export function ListingPdfExportButton<T extends object>({
  title,
  data,
  columns,
  fileName,
  subtitle,
  companyName = "My Trading",
  generatedBy,
  logoSrc,
  reportLabel = "Listing Export",
  metadata = [],
  orientation = "landscape",
  includeSerialNumber = true,
  emptyMessage = "No records available",
  disabled = false,
  buttonLabel = "PDF",
  buttonClassName = "",
  dateAccessor,
}: ListingPdfExportButtonProps<T>) {
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPreset, setExportPreset] = useState<ExportRangePreset>("all");
  const [exportFromDate, setExportFromDate] = useState<Date | null>(null);
  const [exportToDate, setExportToDate] = useState<Date | null>(new Date());

  const getRowDate = (row: T) =>
    dateAccessor ? normalizeExportDate(dateAccessor(row)) : inferDateValue(row);

  const hasDateColumn = useMemo(
    () => data.some((row) => getRowDate(row)),
    [data, dateAccessor]
  );

  const exportRows = useMemo(() => {
    if (exportPreset === "all") return data;
    if (!exportFromDate || !exportToDate || !hasDateColumn) return [];

    const from = new Date(exportFromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(exportToDate);
    to.setHours(23, 59, 59, 999);

    return data.filter((row) => {
      const rowDate = getRowDate(row);
      return rowDate ? rowDate >= from && rowDate <= to : false;
    });
  }, [data, exportFromDate, exportPreset, exportToDate, hasDateColumn, dateAccessor]);

  const handlePresetChange = (preset: ExportRangePreset) => {
    setExportPreset(preset);
    setExportToDate(new Date());

    if (preset === "all") {
      setExportFromDate(null);
      return;
    }

    if (preset === "custom") {
      setExportFromDate((current) => current || getPastDate(1));
      return;
    }

    const months = preset === "1m" ? 1 : preset === "3m" ? 3 : 6;
    setExportFromDate(getPastDate(months));
  };

  const handleOpen = () => {
    handlePresetChange("all");
    setShowExportModal(true);
  };

  const handleDownload = () => {
    if (exportPreset !== "all" && (!exportFromDate || !exportToDate)) {
      ToasterService.error("Date range required", "Select both from and to dates.");
      return;
    }

    if (
      exportPreset !== "all" &&
      exportFromDate &&
      exportToDate &&
      exportFromDate > exportToDate
    ) {
      ToasterService.error("Invalid date range", "From date cannot be after To date.");
      return;
    }

    const rangeLabel =
      exportPreset === "all"
        ? "All records"
        : `${toDateInputValue(exportFromDate as Date)} to ${toDateInputValue(exportToDate as Date)}${
            hasDateColumn ? "" : " (no date column found)"
          }`;
    const resolvedMetadata =
      typeof metadata === "function"
        ? metadata(exportRows, rangeLabel)
        : [
            { label: "Total", value: exportRows.length },
            { label: "Range", value: rangeLabel },
            ...metadata,
          ];

    exportListingPdf<T>({
      title,
      data: exportRows,
      columns,
      fileName,
      subtitle,
      companyName,
      generatedBy,
      logoSrc,
      reportLabel,
      metadata: resolvedMetadata,
      orientation,
      includeSerialNumber,
      emptyMessage,
    });
    setShowExportModal(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled || data.length === 0}
        className={`my-[3px] flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName}`}
        title={`Export ${title} as PDF`}
      >
        <ArrowDownTrayIcon className="h-4 w-4" />
        <span>{buttonLabel}</span>
      </button>

      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-100 p-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Export {title} PDF</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Choose a statement-style period before downloading.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close export options"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "All", value: "all" },
                  { label: "1 Month", value: "1m" },
                  { label: "3 Months", value: "3m" },
                  { label: "6 Months", value: "6m" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handlePresetChange(option.value as ExportRangePreset)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      exportPreset === option.value
                        ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handlePresetChange("custom")}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                  exportPreset === "custom"
                    ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Custom date range
              </button>

              {exportPreset !== "all" && (
                <FloatingDateRangePicker
                  label="Date Range"
                  startDate={exportFromDate}
                  endDate={exportToDate}
                  onChange={([startDate, endDate]) => {
                    setExportPreset("custom");
                    setExportFromDate(startDate);
                    setExportToDate(endDate);
                  }}
                  maxDate={new Date()}
                  monthsShown={1}
                  closeOnSelect
                  helperText="Select the start and end date for this PDF export."
                  className="mb-0"
                />
              )}

              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                PDF will include {exportRows.length}{" "}
                {exportPreset === "all" ? "total" : "date range"} matching records.
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 p-5">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default exportListingPdf;
