import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ArrowDownTrayIcon, PhotoIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ToasterService } from "../../Services/ToasterService";
import PurchaseResourcePage, {
  PurchaseRecord,
  PurchaseResourceConfig,
  SelectOption,
  toNumberOrZero,
} from "../Purchase/PurchaseResourcePage";
import { APP_ROUTES, recordLink } from "../../utils/appRoutes";

/* ------------------------------------------------------------------ */
/* Endpoints & constants                                               */
/* ------------------------------------------------------------------ */

const CATEGORIES = "/v1/api/product/product-categories";
const PRODUCTS = "/v1/api/product/products";

const productImageUrl = (productId: string | number) => `${PRODUCTS}/${productId}/downloadImage`;
const productImageUploadUrl = (productId: string | number) => `${PRODUCTS}/${productId}/uploadImage`;

const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PRODUCT_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const PRODUCT_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const UOM_OPTIONS = [
  "PIECES", "BOX", "PACK", "KILOGRAM", "GRAM", "LITRE", "MILLILITRE",
  "METER", "CENTIMETER", "MILLIMETER", "DOZEN", "BAG", "ROLL",
];

// Keep in sync with the tax codes the backend accepts.
const TAX_CODES = ["GST0", "GST5", "GST18", "GST40"];

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

/** Trimmed string, or null when empty (so the API stores NULL instead of ""). */
const text = (value: unknown): string | null => {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

/** Positive integer id, or null when nothing valid is selected. */
const toId = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

/** Non-negative amount. */
const toAmount = (value: unknown): number => Math.max(0, toNumberOrZero(value));

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const formatFileSize = (sizeInBytes: number) => {
  if (!Number.isFinite(sizeInBytes) || sizeInBytes <= 0) return "0 B";
  if (sizeInBytes < 1024) return `${sizeInBytes} B`;
  if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
};

const extensionForMimeType = (mimeType: string) => {
  switch (mimeType.toLowerCase()) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "png";
  }
};

/* ------------------------------------------------------------------ */
/* Image helpers                                                       */
/* ------------------------------------------------------------------ */

const validateProductImageFile = (file: File) => {
  const fileName = file.name.toLowerCase();
  const hasSupportedMimeType = PRODUCT_IMAGE_TYPES.includes(file.type);
  const hasSupportedExtension = PRODUCT_IMAGE_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  if (!hasSupportedMimeType || !hasSupportedExtension) {
    ToasterService.error("Invalid image format", "Only JPEG, PNG, and WEBP images are allowed.");
    return false;
  }

  if (file.size > PRODUCT_IMAGE_MAX_SIZE_BYTES) {
    ToasterService.error(
      "Image exceeds 5 MB",
      `Selected file size is ${formatFileSize(file.size)}. Please choose an image up to 5 MB.`
    );
    return false;
  }

  return true;
};

const uploadProductImage = async (productId: string | number, file: File) => {
  const payload = new FormData();
  payload.append("file", file);
  // No manual Content-Type: the browser adds multipart/form-data with the correct boundary.
  await axios.post(productImageUploadUrl(productId), payload);
};

const getErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

const toProductImageFileName = (row: PurchaseRecord, extension: string) => {
  const baseName = String(row.productName || row.shortName || row.productCode || "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "-");

  return `${baseName || `product-${row.id ?? "image"}`}.${extension}`;
};

const getProductInitial = (row: PurchaseRecord) =>
  String(row.productName || row.shortName || row.productCode || "P").trim().charAt(0).toUpperCase() || "P";

/** Draws the product's initial on a gradient square. */
const drawInitial = (row: PurchaseRecord, size: number, colors: [string, string], textColor: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const gradient = context.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  context.fillStyle = textColor;
  context.font = `bold ${Math.round(size / 2.2)}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(getProductInitial(row), size / 2, size / 2);

  return canvas;
};

/** Small placeholder shown in the table when a product has no image. */
const createInitialPreviewUrl = (row: PurchaseRecord) =>
  drawInitial(row, 96, ["#cffafe", "#bfdbfe"], "#0f172a")?.toDataURL("image/png") ?? "";

/** Larger initial image that can be uploaded as the product image. */
const createInitialImageFile = async (row: PurchaseRecord) => {
  const canvas = drawInitial(row, 320, ["#0891b2", "#2563eb"], "#ffffff");
  if (!canvas) throw new Error("Failed to generate initial image");

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Failed to generate initial image");

  return new File([blob], `product-${row.id}-initial.png`, { type: "image/png" });
};

/* ------------------------------------------------------------------ */
/* Image cell (table column)                                           */
/* ------------------------------------------------------------------ */

type LoadedImage = { url: string; type: string };

const ProductImageCell = ({ row }: { row: PurchaseRecord }) => {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [imageVersion, setImageVersion] = useState(0);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initialPreviewUrl = useMemo(
    () => createInitialPreviewUrl(row),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row.productName, row.shortName, row.productCode]
  );

  // Load the image only when the product has one (or one was just uploaded),
  // instead of firing a request that 404s for every row without an image.
  useEffect(() => {
    if (!row?.id || (!row.imageName && imageVersion === 0)) {
      setImage(null);
      return;
    }

    let cancelled = false;
    let objectUrl = "";

    setIsLoadingImage(true);
    axios
      .get(productImageUrl(row.id), { responseType: "blob" })
      .then((response) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setImage({ url: objectUrl, type: String(response.data?.type || "") });
      })
      .catch(() => {
        if (!cancelled) setImage(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingImage(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [row?.id, row?.imageName, imageVersion]);

  // Close the preview with the Escape key.
  useEffect(() => {
    if (!isPreviewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsPreviewOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPreviewOpen]);

  const upload = async (file: File, successMessage: string) => {
    if (!row?.id) return;
    try {
      setIsUploading(true);
      await uploadProductImage(row.id, file);
      ToasterService.success(successMessage);
      setImageVersion((current) => current + 1); // reload just this cell
    } catch (error: any) {
      console.error("Failed to upload product image", error);
      ToasterService.error(getErrorMessage(error, "Failed to upload product image"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !validateProductImageFile(file)) return;
    await upload(file, "Product image uploaded");
  };

  const handleUseInitial = async () => {
    try {
      const initialFile = await createInitialImageFile(row);
      await upload(initialFile, "Product image changed to initial");
      setIsPreviewOpen(false);
    } catch (error: any) {
      ToasterService.error(getErrorMessage(error, "Failed to set product initial image"));
    }
  };

  // The image is already loaded, so download it from memory instead of fetching it again.
  const handleDownload = () => {
    if (!image) return;
    const link = document.createElement("a");
    link.href = image.url;
    link.download = toProductImageFileName(row, extensionForMimeType(image.type));
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const isBusy = isUploading || isLoadingImage;
  const productLabel = row.productName || "Product image";

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={PRODUCT_IMAGE_TYPES.join(",")}
        onChange={handleFileChange}
        className="hidden"
      />

      {image ? (
        <button
          type="button"
          onClick={() => setIsPreviewOpen(true)}
          disabled={isBusy}
          className="h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          title={`View image of ${productLabel}`}
        >
          <img src={image.url} alt={productLabel} className="h-full w-full object-cover" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          className="h-12 w-12 overflow-hidden rounded-xl border border-cyan-200 bg-cyan-50 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
          title={isUploading ? "Uploading image" : "Upload image"}
        >
          {isBusy || !initialPreviewUrl ? (
            <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-cyan-700">
              {isBusy ? "..." : getProductInitial(row)}
            </span>
          ) : (
            <img src={initialPreviewUrl} alt="" aria-hidden="true" className="h-full w-full object-cover" />
          )}
        </button>
      )}

      {isPreviewOpen && image && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={productLabel}
            className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsPreviewOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <img src={image.url} alt={productLabel} className="h-72 w-full object-cover" />
            </div>

            <div className="mt-4 text-sm font-semibold text-slate-800">{productLabel}</div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PhotoIcon className="h-4 w-4" aria-hidden="true" />
                {isUploading ? "Uploading..." : "Change"}
              </button>
              <button
                type="button"
                onClick={handleUseInitial}
                disabled={isUploading}
                className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Use Initial
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const cleanText = (value: unknown) => String(value ?? "").trim();

/** Up to 2 decimal places, not negative. */
const validateAmount = (label: string, value: unknown): string | null => {
  const raw = cleanText(value);
  if (raw === "") return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount)) return `${label} must be a number`;
  if (amount < 0) return `${label} cannot be negative`;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return `${label} can have at most 2 decimal places`;
  if (amount > 99999999) return `${label} is too large`;
  return null;
};

/**
 * All product checks in one place.
 * GST: the product's GST is its Tax Code (required, from the fixed list).
 * The vendor's GSTIN is checked on the Vendor form, not here.
 */
const validateProductForm = (form: PurchaseRecord, categories: SelectOption[]): Record<string, string> => {
  const errors: Record<string, string> = {};
  const add = (field: string, message: string | null) => {
    if (message && !errors[field]) errors[field] = message;
  };

  // Category: a deactivated category cannot take new products. An existing product
  // may keep its own (now inactive) category, but cannot move into another inactive one.
  const selected = categories.find((option) => String(option.value) === String(form.categoryId ?? ""));
  const keepsOwnCategory = String(form.categoryId ?? "") === String(form.originalCategoryId ?? "");
  if (selected && selected.raw?.active === false && !keepsOwnCategory) {
    add("categoryId", `${selected.label} is inactive. Activate it in Product Categories, or choose another category.`);
  }

  // Names
  const productName = cleanText(form.productName);
  if (productName) {
    if (productName.length < 2) add("productName", "Product name is too short");
    else if (productName.length > 100) add("productName", "Product name can be at most 100 characters");
    else if (!/[A-Za-z]/.test(productName)) add("productName", "Product name must contain letters");
  }

  const shortName = cleanText(form.shortName);
  if (shortName) {
    if (shortName.length < 2 || shortName.length > 20) add("shortName", "Short name must be 2–20 characters");
    else if (!/^[A-Za-z0-9 &.-]+$/.test(shortName)) add("shortName", "Short name: letters, numbers, space, & . - only");
  }

  if (cleanText(form.description).length > 500) add("description", "Description can be at most 500 characters");

  // Brand & identification
  const brand = cleanText(form.brand);
  if (brand) {
    if (brand.length > 50) add("brand", "Brand can be at most 50 characters");
    else if (!/[A-Za-z]/.test(brand)) add("brand", "Brand must contain letters");
  }

  const modelNo = cleanText(form.modelNo);
  if (modelNo) {
    if (modelNo.length > 50) add("modelNo", "Model No can be at most 50 characters");
    else if (!/^[A-Za-z0-9][A-Za-z0-9 ./-]*$/.test(modelNo)) {
      add("modelNo", "Model No: letters, numbers and - / . only (e.g. AR18BYNZXWK)");
    }
  }

  // Pricing
  add("standardCost", validateAmount("Standard cost", form.standardCost));
  add("sellingPrice", validateAmount("Selling price", form.sellingPrice));

  // Item type and tracking: shown as errors instead of being silently changed on save.
  const serviceItem = Boolean(form.serviceItem);
  const stockItem = Boolean(form.stockItem);
  if (serviceItem && stockItem) add("serviceItem", "A product is either a Stock Item or a Service Item, not both");
  if (!serviceItem && !stockItem) add("stockItem", "Choose Stock Item or Service Item");
  if (!stockItem && form.serialTracking) add("serialTracking", "Serial tracking is only for stock items");
  if (!stockItem && form.batchTracking) add("batchTracking", "Batch tracking is only for stock items");
  if (form.expiryTracking && !form.batchTracking) add("expiryTracking", "Expiry tracking needs Batch Tracking (expiry is kept per batch)");

  return errors;
};

/* ------------------------------------------------------------------ */
/* Loading one product in full                                         */
/* ------------------------------------------------------------------ */

/** Copies only the fields that have a value, so a missing field never overwrites a real one. */
const mergeFilled = (base: PurchaseRecord, extra: PurchaseRecord | undefined) => {
  const merged = { ...base };
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") merged[key] = value;
  });
  return merged;
};

/**
 * GET /products/{id} does not return shortName, description and taxCode yet, but
 * POST /products/batch does. Both are called and merged, so Edit shows every field and
 * the status dropdown never saves those fields as empty.
 * When the backend fixes GET, this still works (the batch call just adds nothing new).
 */
const loadProduct = async (row: PurchaseRecord): Promise<PurchaseRecord> => {
  const [byId, batch] = await Promise.allSettled([
    axios.get(`${PRODUCTS}/${row.id}`),
    axios.post(`${PRODUCTS}/batch`, { productIds: [Number(row.id)] }),
  ]);

  if (byId.status === "rejected" && batch.status === "rejected") throw byId.reason;

  const fromGet = byId.status === "fulfilled" ? byId.value.data : undefined;
  const batchData = batch.status === "fulfilled" ? batch.value.data : undefined;
  const batchList: PurchaseRecord[] = Array.isArray(batchData)
    ? batchData
    : batchData?.data || batchData?.content || [];
  const fromBatch = batchList.find((item) => String(item?.id) === String(row.id));

  return mergeFilled(mergeFilled(row, fromGet), fromBatch);
};

/* ------------------------------------------------------------------ */
/* Resource configuration                                              */
/* ------------------------------------------------------------------ */

/** "Stock" or "Service" (they can't both be true; see validateProductForm). */
const itemTypeText = (row: PurchaseRecord) => (row.serviceItem ? "Service" : row.stockItem ? "Stock" : "--");

/** Type pill: cyan for Stock, violet for Service. Tracking (Batch / Serial / Expiry) shows on hover. */
const renderItemType = (row: PurchaseRecord) => {
  const text = itemTypeText(row);
  if (text === "--") return "--";
  const tracking = [row.batchTracking && "Batch", row.serialTracking && "Serial", row.expiryTracking && "Expiry"]
    .filter(Boolean)
    .join(", ");
  return (
    <span
      title={text === "Stock" ? `Tracking: ${tracking || "none"}` : "Service item (no stock)"}
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
        text === "Stock"
          ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300"
          : "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
      }`}
    >
      {text}
    </span>
  );
};

const renderAmount = (key: string) => (row: PurchaseRecord) =>
  row[key] == null ? "--" : currencyFormatter.format(Number(row[key]));

const baseProductConfig: PurchaseResourceConfig = {
  title: "Products",
  description: "Maintain products from the Product Catalogue service.",
  endpoint: PRODUCTS,
  getByIdEndpoint: (row) => `${PRODUCTS}/${row.id}`,
  // Opened from a link: show only that product.
  scope: { idParam: "productId", nameParam: "productName", label: "Product" },
  // Active / Inactive dropdown in the table. It saves the whole product with PUT, so the
  // product is first loaded in full by loadProduct() below (GET + batch), so no field is lost.
  allowInlineActiveToggle: true,
  loadRecord: (row) => loadProduct(row),
  // Stock/service flags are not toggled inline: changing them on a product that
  // already has stock or transactions must go through the edit form.

  columns: [
    { key: "imageName", label: "Image", render: (row) => <ProductImageCell row={row} /> },
    { key: "productName", label: "Product Name" },
    // Codes should stay on one line (e.g. TEXTILE-TXTL-0001), never break in the middle.
    { key: "productCode", label: "Product Code", className: "whitespace-nowrap" },
    // The product API now returns the category as a nested object (productCategory).
    {
      key: "categoryName",
      label: "Category",
      render: (row) => row.productCategory?.categoryName || row.categoryName || "--",
      // Click → Product Categories page showing only this category.
      link: (row) =>
        recordLink(
          APP_ROUTES.productCategories,
          "categoryId",
          row.productCategory?.id ?? row.categoryId,
          "categoryName",
          row.productCategory?.categoryName || row.categoryName
        ),
    },
    { key: "brand", label: "Brand" },
    { key: "uom", label: "UOM" },
    // One "Type" column instead of two Yes/No columns: a product is either Stock or Service, never both.
    {
      key: "stockItem",
      label: "Type",
      render: (row) => renderItemType(row),
      exportValue: (row) => itemTypeText(row),
      sortValueGetter: (row) => itemTypeText(row),
    },
    { key: "standardCost", label: "Standard Cost", render: renderAmount("standardCost") },
    { key: "sellingPrice", label: "Selling Price", render: renderAmount("sellingPrice") },
    // Status is the last column.
    {
      key: "active",
      label: "Status",
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
            row.active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {row.active ? "Active" : "Inactive"}
        </span>
      ),
    },
  ],

  fields: [
    // Tab 1 starts with Category: it decides the product code (CATEGORY-SHORTCODE-0001),
    // and only active categories can take new products. Then the product's name.
    {
      name: "categoryId", section: "Category & Name",
      label: "Category",
      type: "select",
      required: true,
      searchable: true,
      placeholder: "Type to search category",
      optionsEndpoint: CATEGORIES,
      optionLabel: "categoryName",
      // Only active categories can take new products. An existing product keeps
      // showing its current category even if that category was deactivated later.
      getOptions: ({ form, options }) =>
        (options.categoryId || []).filter(
          (option) =>
            option.raw?.active !== false || String(option.value) === String(form.originalCategoryId ?? "")
        ),
    },
    // Typed in small letters → shown and saved in CAPITALS.
    { name: "productName", section: "Category & Name", label: "Product Name", required: true, textCase: "upper", maxLength: 100 },
    { name: "shortName", section: "Category & Name", label: "Short Name", textCase: "upper", maxLength: 20 },
    { name: "description", section: "Category & Name", label: "Description", type: "textarea", gridClassName: "md:col-span-2" },
    // Tab 2: optional details that identify the exact item.
    { name: "brand", section: "Brand & Identification", label: "Brand", textCase: "title", maxLength: 50 },
    { name: "modelNo", section: "Brand & Identification", label: "Model No", textCase: "upper", maxLength: 50 },
    {
      name: "barcode", section: "Brand & Identification",
      label: "Barcode (EAN/UPC, 8–14 digits)",
      maxLength: 14,
      // Standard retail barcodes are EAN-8, UPC-A (12), EAN-13 or GTIN-14: digits only.
      validate: (value) => {
        const barcode = String(value ?? "").replace(/\s/g, "");
        if (!barcode) return null;
        if (!/^[0-9]+$/.test(barcode)) return "Barcode must contain digits only";
        return [8, 12, 13, 14].includes(barcode.length)
          ? null
          : `Barcode must be 8, 12, 13 or 14 digits (you entered ${barcode.length})`;
      },
    },
    {
      name: "uom", section: "Pricing & Tax",
      label: "UOM",
      type: "select",
      required: true,
      defaultValue: "PIECES",
      options: UOM_OPTIONS.map((item) => ({ value: item, label: item })),
    },
    { name: "standardCost", section: "Pricing & Tax", label: "Standard Cost (₹)", type: "number", defaultValue: 0, min: 0, decimals: 2, max: 99999999 },
    { name: "sellingPrice", section: "Pricing & Tax", label: "Selling Price (₹)", type: "number", defaultValue: 0, min: 0, decimals: 2, max: 99999999 },
    {
      name: "taxCode", section: "Pricing & Tax",
      label: "Tax Code",
      type: "select",
      required: true,
      options: TAX_CODES.map((item) => ({ value: item, label: item })),
    },
    { name: "stockItem", section: "Inventory Tracking", label: "Stock Item", type: "checkbox", defaultValue: true },
    { name: "serviceItem", section: "Inventory Tracking", label: "Service Item", type: "checkbox", defaultValue: false },
    { name: "serialTracking", section: "Inventory Tracking", label: "Serial Tracking", type: "checkbox", defaultValue: false },
    { name: "batchTracking", section: "Inventory Tracking", label: "Batch Tracking", type: "checkbox", defaultValue: false },
    { name: "expiryTracking", section: "Inventory Tracking", label: "Expiry Tracking (needs Batch Tracking)", type: "checkbox", defaultValue: false },
    // Status is changed here (create and edit).
    { name: "active", section: "Inventory Tracking", label: "Active", type: "checkbox", defaultValue: true },
  ],

  searchFields: ["productName", "productCode", "categoryName", "brand", "uom"],

  // Errors are shown under each field (and a red dot on its tab) while the user types.
  validateFields: (form, _editingRow, { options }) => validateProductForm(form, options.categoryId || []),

  // A new product starts empty; only sensible defaults are pre-filled.
  initialFormState: {
    productName: "",
    shortName: "",
    description: "",
    categoryId: "",
    brand: "",
    modelNo: "",
    barcode: "",
    uom: "PIECES",
    standardCost: 0,
    sellingPrice: 0,
    taxCode: "",
    stockItem: true,
    serviceItem: false,
    serialTracking: false,
    batchTracking: false,
    expiryTracking: false,
    active: true,
  },

  normalizeForm: (row) => ({
    ...row,
    categoryId: row.productCategory?.id ?? row.categoryId ?? row.category?.id ?? "",
    // Remembered so an existing product can keep an (now inactive) category, but not move into one.
    originalCategoryId: row.productCategory?.id ?? row.categoryId ?? row.category?.id ?? "",
  }),

  buildPayload: (form) => {
    // Business rules:
    //  - a service item is never a stock item and has no tracking
    //  - serial/batch tracking only applies to stock items
    //  - expiry is tracked per batch, so it requires batch tracking
    const serviceItem = Boolean(form.serviceItem);
    const stockItem = !serviceItem && Boolean(form.stockItem);
    const batchTracking = stockItem && Boolean(form.batchTracking);

    return {
      productName: text(form.productName),
      shortName: text(form.shortName),
      description: text(form.description),
      categoryId: toId(form.categoryId),
      brand: text(form.brand),
      modelNo: text(form.modelNo),
      barcode: text(form.barcode)?.replace(/\s/g, "") ?? null,
      uom: form.uom || "PIECES",
      standardCost: toAmount(form.standardCost),
      sellingPrice: toAmount(form.sellingPrice),
      taxCode: text(form.taxCode),
      stockItem,
      serviceItem,
      serialTracking: stockItem && Boolean(form.serialTracking),
      batchTracking,
      expiryTracking: batchTracking && Boolean(form.expiryTracking),
      active: Boolean(form.active),
    };
  },
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Products() {
  const navigate = useNavigate();

  // Set when the user clicks "+" on a category in the Categories page.
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get("categoryId") || "";
  const categoryName = searchParams.get("categoryName") || "";

  const [reloadKey, setReloadKey] = useState(0);
  const [createdProduct, setCreatedProduct] = useState<PurchaseRecord | null>(null);
  const [postCreateImageFile, setPostCreateImageFile] = useState<File | null>(null);
  const [isPostCreateUploading, setIsPostCreateUploading] = useState(false);

  const closePostCreatePopup = () => {
    setCreatedProduct(null);
    setPostCreateImageFile(null);
    setIsPostCreateUploading(false);
  };

  const handlePostCreateImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    setPostCreateImageFile(file && validateProductImageFile(file) ? file : null);
  };

  const handlePostCreateImageUpload = async () => {
    if (!createdProduct?.id || !postCreateImageFile) return;

    try {
      setIsPostCreateUploading(true);
      await uploadProductImage(createdProduct.id, postCreateImageFile);
      ToasterService.success("Product image uploaded");
      setReloadKey((current) => current + 1); // refresh the list so the new image shows
      closePostCreatePopup();
    } catch (error: any) {
      console.error("Failed to upload product image", error);
      ToasterService.error(getErrorMessage(error, "Failed to upload product image"));
      setIsPostCreateUploading(false);
    }
  };

  const productConfig: PurchaseResourceConfig = {
    ...baseProductConfig,

    // Coming from a category: open the create form with that category pre-selected.
    autoOpenCreate: Boolean(categoryId),
    autoOpenCreateKey: categoryId ? `category-product-${categoryId}` : undefined,
    initialCreateState: categoryId ? { categoryId } : undefined,
    formSubtitle: categoryName ? `Creating a product in ${categoryName}.` : undefined,

    afterSubmit: ({ savedRow, isCreate }) => {
      if (!isCreate || !savedRow?.id) return;

      // The category link has done its job. Clear it so the create form
      // doesn't open again when the list reloads (e.g. after the image upload).
      if (categoryId) setSearchParams({}, { replace: true });

      setCreatedProduct(savedRow);
      setPostCreateImageFile(null);
    },
    renderSearchExtras: () => (
      <button
        type="button"
        onClick={() => navigate("/product-catalogue/categories")}
        className="inline-flex items-center rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-medium text-cyan-700 transition hover:bg-cyan-100"
      >
        + Category
      </button>
    ),
  };

  return (
    <>
      <PurchaseResourcePage key={reloadKey} config={productConfig} />

      {createdProduct && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={closePostCreatePopup}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-product-image-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="upload-product-image-title" className="text-lg font-semibold text-slate-900">
                  Upload Product Image
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Product created successfully. Upload an image for {createdProduct.productName || "this product"}.
                </p>
              </div>
              <button
                type="button"
                onClick={closePostCreatePopup}
                aria-label="Close"
                className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-700">Allowed types: JPEG, PNG, WEBP</div>
              <div className="mt-1 text-xs text-slate-500">Maximum size: 5 MB</div>

              <input
                type="file"
                accept={PRODUCT_IMAGE_TYPES.join(",")}
                onChange={handlePostCreateImageChange}
                className="mt-4 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-cyan-700 hover:file:bg-cyan-100"
              />

              <div className="mt-3 grid gap-2 text-xs text-slate-500">
                <div>Selected file: {postCreateImageFile?.name || "--"}</div>
                <div>Selected size: {postCreateImageFile ? formatFileSize(postCreateImageFile.size) : "--"}</div>
                <div>Selected type: {postCreateImageFile?.type || "--"}</div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closePostCreatePopup}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handlePostCreateImageUpload}
                disabled={!postCreateImageFile || isPostCreateUploading}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPostCreateUploading ? "Uploading..." : "Upload Image"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
