import { useNavigate } from "react-router-dom";
import PurchaseResourcePage, {
  PurchaseResourceConfig,
  SelectOption,
  toNumberOrZero,
} from "./PurchaseResourcePage";

const CATEGORIES = "/v1/api/purchase/product-categories";
const PRODUCTS = "/v1/api/purchase/products";

const getParentCategoryOptions = (categoryOptions: SelectOption[]) =>
  categoryOptions.filter((option) => !option.raw?.parentId);

const getChildCategoryOptions = (categoryOptions: SelectOption[], parentCategoryId: string | number) =>
  categoryOptions.filter((option) => String(option.raw?.parentId ?? "") === String(parentCategoryId));

const productConfig: PurchaseResourceConfig = {
  title: "Products",
  description: "Maintain purchase products from the purchase product controller.",
  endpoint: PRODUCTS,
  columns: [
    { key: "productCode", label: "Code" },
    { key: "productName", label: "Product Name" },
    { key: "categoryName", label: "Category" },
    { key: "brand", label: "Brand" },
    { key: "uom", label: "UOM" },
    { key: "standardCost", label: "Standard Cost" },
    { key: "sellingPrice", label: "Selling Price" },
    { key: "stockItem", label: "Stock Item" },
    { key: "serviceItem", label: "Service Item" },
    { key: "active", label: "Status" },
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
  searchFields: ["productCode", "productName", "categoryName", "brand", "uom"],
  normalizeForm: (row) => ({
    ...row,
    parentCategoryId: row.category?.parentId ?? row.parentCategoryId ?? "",
    categoryId: row.category?.id ?? row.categoryId ?? "",
  }),
  buildPayload: (form) => ({
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
  }),
};

export default function Products() {
  const navigate = useNavigate();

  return (
    <PurchaseResourcePage
      config={{
        ...productConfig,
        renderHeaderActions: () => (
          <button
            type="button"
            onClick={() => navigate("/product-categories")}
            className="inline-flex items-center rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-100"
          >
            Add Category
          </button>
        ),
      }}
    />
  );
}
