import { ChangeEvent, useEffect, useRef, useState } from "react";
import axios from "axios";
import { ArrowDownTrayIcon, PhotoIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { ToasterService } from "../../Services/ToasterService";
import PurchaseResourcePage, {
  PurchaseRecord,
  PurchaseResourceConfig,
  SelectOption,
  toNumberOrZero,
} from "./PurchaseResourcePage";

const CATEGORIES = "/v1/api/purchase/product-categories";
const PRODUCTS = "/v1/api/purchase/products";
const PRODUCT_IMAGE_UPLOAD_BASE = "/v1/api/purchase/products";
const PRODUCT_IMAGE_DOWNLOAD_BASE = "/v1/api/purchase/products";
const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PRODUCT_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const PRODUCT_IMAGE_MAX_SIZE_BYTES = 5_000_000;

const getStoredTenantId = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.tenantId || "";
  } catch {
    return "";
  }
};

const getParentCategoryOptions = (categoryOptions: SelectOption[]) =>
  categoryOptions.filter((option) => !option.raw?.parentId);

const getChildCategoryOptions = (categoryOptions: SelectOption[], parentCategoryId: string | number) =>
  categoryOptions.filter((option) => String(option.raw?.parentId ?? "") === String(parentCategoryId));

const getProductImageDownloadUrl = (productId: string | number) =>
  `${PRODUCT_IMAGE_DOWNLOAD_BASE}/${productId}/downloadImage`;

const getProductImageUploadUrl = (productId: string | number) =>
  `${PRODUCT_IMAGE_UPLOAD_BASE}/${productId}/uploadImage`;

const formatFileSize = (sizeInBytes: number) => {
  if (!Number.isFinite(sizeInBytes) || sizeInBytes <= 0) return "0 B";
  if (sizeInBytes < 1024) return `${sizeInBytes} B`;
  if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
};

const validateProductImageFile = (file: File) => {
  const fileName = String(file.name || "").toLowerCase();
  const hasSupportedMimeType = PRODUCT_IMAGE_TYPES.includes(file.type);
  const hasSupportedExtension = PRODUCT_IMAGE_EXTENSIONS.some((extension) =>
    fileName.endsWith(extension)
  );

  if (!hasSupportedMimeType || !hasSupportedExtension) {
    ToasterService.error(
      "Invalid image format",
      "Only JPEG, PNG, and WEBP images are allowed."
    );
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

  await axios.post(getProductImageUploadUrl(productId), payload, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

const toProductImageFileName = (row: PurchaseRecord, fallbackExtension = "png") => {
  const baseName = String(row.productName || row.shortName || row.productCode || `product-${row.id || "image"}`)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "-");

  const safeBaseName = baseName || `product-${row.id || "image"}`;
  return `${safeBaseName}.${fallbackExtension}`;
};

const getProductInitial = (row: PurchaseRecord) =>
  String(row.productName || row.shortName || row.productCode || "P").trim().charAt(0).toUpperCase() || "P";

const createProductInitialDataUrl = (row: PurchaseRecord) => {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (!context) return "";

  const gradient = context.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#cffafe");
  gradient.addColorStop(1, "#bfdbfe");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  context.fillStyle = "#0f172a";
  context.font = "bold 40px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(getProductInitial(row), size / 2, size / 2);

  return canvas.toDataURL("image/png");
};

const createInitialImageFile = async (row: PurchaseRecord) => {
  const size = 320;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to generate initial image");
  }

  const gradient = context.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#0891b2");
  gradient.addColorStop(1, "#2563eb");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  context.fillStyle = "#ffffff";
  context.font = "bold 160px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(getProductInitial(row), size / 2, size / 2);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    throw new Error("Failed to generate initial image");
  }

  return new File([blob], `product-${row.id}-initial.png`, { type: "image/png" });
};

const ProductImageCell = ({
  row,
  onUploaded,
}: {
  row: PurchaseRecord;
  onUploaded: () => void;
}) => {
  const [imageUrl, setImageUrl] = useState<string>("");
  const [hasRealImage, setHasRealImage] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let objectUrl = "";

    const loadImage = async () => {
      if (!row?.id) {
        setImageUrl("");
        setHasRealImage(false);
        return;
      }

      try {
        setIsLoadingImage(true);
        const response = await axios.get(getProductImageDownloadUrl(row.id), {
          responseType: "blob",
        });
        objectUrl = window.URL.createObjectURL(response.data);
        setImageUrl(objectUrl);
        setHasRealImage(true);
      } catch (_error) {
        setImageUrl(createProductInitialDataUrl(row));
        setHasRealImage(false);
      } finally {
        setIsLoadingImage(false);
      }
    };

    loadImage();

    return () => {
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [row?.id, row?.imageName]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file || !row?.id) return;

    if (!validateProductImageFile(file)) {
      return;
    }

    try {
      setIsUploading(true);
      await uploadProductImage(row.id, file);
      ToasterService.success("Product image uploaded");
      onUploaded();
    } catch (error: any) {
      console.error("Failed to upload product image", error);
      ToasterService.error(
        error.response?.data?.message || "Failed to upload product image"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!row?.id || !hasRealImage) return;

    try {
      setIsDownloading(true);
      const response = await axios.get(getProductImageDownloadUrl(row.id), {
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      const contentType = String(response.data?.type || "").toLowerCase();
      const extension =
        contentType === "image/jpeg" ? "jpg" :
        contentType === "image/png" ? "png" :
        contentType === "image/webp" ? "webp" :
        "png";
      const fileName = toProductImageFileName(row, extension);
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error: any) {
      console.error("Failed to download product image", error);
      ToasterService.error(
        error.response?.data?.message || "Failed to download product image"
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUseInitial = async () => {
    if (!row?.id) return;

    try {
      setIsUploading(true);
      const initialFile = await createInitialImageFile(row);
      await uploadProductImage(row.id, initialFile);
      ToasterService.success("Product image changed to initial");
      setIsPreviewOpen(false);
      onUploaded();
    } catch (error: any) {
      console.error("Failed to set product initial image", error);
      ToasterService.error(
        error.response?.data?.message || error.message || "Failed to set product initial image"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const hasExistingImage = hasRealImage;

  return (
    <>
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept={PRODUCT_IMAGE_TYPES.join(",")}
          onChange={handleFileChange}
          className="hidden"
        />

        {hasExistingImage ? (
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            disabled={isLoadingImage}
            className="h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            title={row.productName || "Product image"}
          >
            <img
              src={imageUrl}
              alt={row.productName || "Product image"}
              className="h-full w-full object-cover"
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isLoadingImage}
            className="h-12 w-12 overflow-hidden rounded-xl border border-cyan-200 bg-cyan-50 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            title={isUploading ? "Uploading image" : "Upload image"}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={row.productName || "Product initial"}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-cyan-700">
                {isUploading ? "..." : isLoadingImage ? "..." : getProductInitial(row)}
              </span>
            )}
          </button>
        )}
      </div>

      {isPreviewOpen && hasExistingImage && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsPreviewOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <img
                src={imageUrl}
                alt={row.productName || "Product image"}
                className="h-72 w-full object-cover"
              />
            </div>

            <div className="mt-4 text-sm font-semibold text-slate-800">{row.productName || "Product Image"}</div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PhotoIcon className="h-4 w-4" />
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
                disabled={isDownloading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                {isDownloading ? "Downloading..." : "Download"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const baseProductConfig: PurchaseResourceConfig = {
  title: "Products",
  description: "Maintain purchase products from the purchase product controller.",
  endpoint: PRODUCTS,
  allowInlineActiveToggle: true,
  inlineBooleanFields: ["stockItem", "serviceItem"],
  columns: [
    { key: "imageName", label: "Image" },
    { key: "productName", label: "Product Name" },
    { key: "productCode", label: "Product Code" },
    { key: "categoryName", label: "Category" },
    { key: "brand", label: "Brand" },
    { key: "uom", label: "UOM" },
    { key: "active", label: "Status" },
    { key: "stockItem", label: "Stock Item" },
    { key: "serviceItem", label: "Service Item" },
    { key: "standardCost", label: "Standard Cost" },
    { key: "sellingPrice", label: "Selling Price" },
  ],
  fields: [
    { name: "productName", label: "Product Name", required: true },
    { name: "shortName", label: "Short Name" },
    { name: "description", label: "Description", type: "textarea", gridClassName: "md:col-span-2" },
    {
      name: "parentCategoryId",
      label: "Parent Category",
      type: "select",
      optionsEndpoint: CATEGORIES,
      getOptionsParams: () => ({ tenantId: getStoredTenantId() }),
      optionLabel: "categoryName",
      placeholderOption: "Select Parent Category",
      getOptions: ({ options }) => getParentCategoryOptions(options.parentCategoryId || []),
      onValueChange: () => ({ categoryId: "" }),
    },
    {
      name: "categoryId",
      label: "Category",
      type: "select",
      required: true,
      optionsEndpoint: CATEGORIES,
      getOptionsParams: () => ({ tenantId: getStoredTenantId() }),
      optionLabel: "categoryName",
      placeholderOption: "Select Category",
      getOptions: ({ form, options }) =>
        form.parentCategoryId ? getChildCategoryOptions(options.categoryId || [], form.parentCategoryId) : [],
    },
    { name: "brand", label: "Brand" },
    { name: "modelNo", label: "Model No" },
    { name: "barcode", label: "Barcode" },
    { name: "uom", label: "UOM", type: "select", defaultValue: "PIECES", options: ["PIECES", "KG", "LITER", "METER", "BOX", "PACK"].map((item) => ({ value: item, label: item })) },
    { name: "standardCost", label: "Standard Cost", type: "number", defaultValue: 0 },
    { name: "sellingPrice", label: "Selling Price", type: "number", defaultValue: 0 },
    { name: "taxCode", label: "Tax Code" },
    { name: "stockItem", label: "Stock Item", type: "checkbox", defaultValue: true },
    { name: "serviceItem", label: "Service Item", type: "checkbox", defaultValue: false },
    { name: "serialTracking", label: "Serial Tracking", type: "checkbox", defaultValue: false },
    { name: "batchTracking", label: "Batch Tracking", type: "checkbox", defaultValue: false },
    { name: "active", label: "Active", type: "checkbox", defaultValue: true },
  ],
  searchFields: ["productName", "categoryName", "brand", "uom", "imageName"],
  normalizeForm: (row) => ({
    ...row,
    parentCategoryId: row.category?.parentId ?? row.parentCategoryId ?? "",
    categoryId: row.category?.id ?? row.categoryId ?? "",
  }),
  buildPayload: (form) => {
    return {
      productName: form.productName,
      shortName: form.shortName,
      description: form.description,
      categoryId: toNumberOrZero(form.categoryId),
      brand: form.brand,
      modelNo: form.modelNo,
      barcode: form.barcode,
      uom: form.uom || "PIECES",
      standardCost: toNumberOrZero(form.standardCost),
      sellingPrice: toNumberOrZero(form.sellingPrice),
      taxCode: form.taxCode,
      stockItem: Boolean(form.stockItem),
      serviceItem: Boolean(form.serviceItem),
      serialTracking: Boolean(form.serialTracking),
      batchTracking: Boolean(form.batchTracking),
      active: Boolean(form.active),
    };
  },
};

export default function Products() {
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  const [createdProductForImage, setCreatedProductForImage] = useState<PurchaseRecord | null>(null);
  const [postCreateImageFile, setPostCreateImageFile] = useState<File | null>(null);
  const [isPostCreateUploading, setIsPostCreateUploading] = useState(false);

  const closePostCreateImagePopup = () => {
    setCreatedProductForImage(null);
    setPostCreateImageFile(null);
    setIsPostCreateUploading(false);
  };

  const handlePostCreateImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";

    if (!file) {
      setPostCreateImageFile(null);
      return;
    }

    if (!validateProductImageFile(file)) {
      setPostCreateImageFile(null);
      return;
    }

    setPostCreateImageFile(file);
  };

  const handlePostCreateImageUpload = async () => {
    if (!createdProductForImage?.id || !postCreateImageFile) return;

    try {
      setIsPostCreateUploading(true);
      await uploadProductImage(createdProductForImage.id, postCreateImageFile);
      ToasterService.success("Product image uploaded");
      setReloadKey((current) => current + 1);
      closePostCreateImagePopup();
    } catch (error: any) {
      console.error("Failed to upload product image", error);
      ToasterService.error(
        error.response?.data?.message || "Failed to upload product image"
      );
    } finally {
      setIsPostCreateUploading(false);
    }
  };

  const productConfig: PurchaseResourceConfig = {
    ...baseProductConfig,
    afterSubmit: ({ savedRow, isCreate }) => {
      if (!isCreate || !savedRow?.id) return;
      setCreatedProductForImage(savedRow);
      setPostCreateImageFile(null);
    },
    columns: baseProductConfig.columns.map((column) =>
      column.key === "imageName"
        ? {
            ...column,
            render: (row) => (
              <ProductImageCell
                row={row}
                onUploaded={() => setReloadKey((current) => current + 1)}
              />
            ),
          }
        : column
    ),
  };

  return (
    <>
      <PurchaseResourcePage
        key={reloadKey}
        config={{
          ...productConfig,
          renderHeaderActions: () => (
            <button
              type="button"
              onClick={() => navigate("/product-categories")}
              className="inline-flex items-center rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-100"
            >
              + npm run devCategory
            </button>
          ),
        }}
      />

      {createdProductForImage && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={closePostCreateImagePopup}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Upload Product Image</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Product created successfully. Upload an image for {createdProductForImage.productName || "this product"}.
                </p>
              </div>
              <button
                type="button"
                onClick={closePostCreateImagePopup}
                className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <XMarkIcon className="h-5 w-5" />
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
                onClick={closePostCreateImagePopup}
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
