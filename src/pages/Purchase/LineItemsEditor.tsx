import React from "react";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline";

export type LineItem = {
  id?: number | string;
  productId: number | string;
  productName?: string;
  categoryId?: number | string;
  quantity: number;
  unitOfMeasure: string;
  remarks?: string;
};

type Props = {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  products: Array<{ id: number | string; productName: string }>;
  categories?: Array<{ id: number | string; categoryName: string }>;
  uomOptions?: string[];
  disabled?: boolean;
};

const DEFAULT_UOM = ["PIECES", "KG", "LITER", "METER", "BOX", "PACK"];

export default function LineItemsEditor({
  items,
  onChange,
  products,
  categories = [],
  uomOptions = DEFAULT_UOM,
  disabled = false,
}: Props) {
  const addRow = () => {
    onChange([
      ...items,
      {
        productId: "",
        categoryId: "",
        quantity: 1,
        unitOfMeasure: "PIECES",
        remarks: "",
      },
    ]);
  };

  const updateRow = (index: number, patch: Partial<LineItem>) => {
    const next = items.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const removeRow = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const cellInput =
    "w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50";

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <div>
          <div className="text-sm font-semibold text-slate-800">Line Items</div>
          <div className="text-xs text-slate-500">
            {items.length === 0
              ? "No items added yet"
              : `${items.length} item${items.length === 1 ? "" : "s"}`}
          </div>
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 disabled:opacity-50"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add Item
        </button>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          Click <span className="font-medium text-slate-700">Add Item</span> to start building the list.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-8 px-3 py-2">#</th>
                <th className="px-3 py-2">Product</th>
                {categories.length > 0 && <th className="px-3 py-2">Category</th>}
                <th className="w-24 px-3 py-2">Qty</th>
                <th className="w-28 px-3 py-2">UOM</th>
                <th className="px-3 py-2">Remarks</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row, index) => (
                <tr key={index} className="align-top">
                  <td className="px-3 py-2 text-xs text-slate-400">{index + 1}</td>
                  <td className="px-3 py-2">
                    <select
                      value={row.productId}
                      onChange={(e) => {
                        const product = products.find(
                          (p) => String(p.id) === String(e.target.value)
                        );
                        updateRow(index, {
                          productId: e.target.value,
                          productName: product?.productName,
                        });
                      }}
                      disabled={disabled}
                      className={cellInput}
                    >
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.productName}
                        </option>
                      ))}
                    </select>
                  </td>
                  {categories.length > 0 && (
                    <td className="px-3 py-2">
                      <select
                        value={row.categoryId || ""}
                        onChange={(e) => updateRow(index, { categoryId: e.target.value })}
                        disabled={disabled}
                        className={cellInput}
                      >
                        <option value="">—</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.categoryName}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) =>
                        updateRow(index, { quantity: Number(e.target.value || 0) })
                      }
                      disabled={disabled}
                      className={cellInput}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={row.unitOfMeasure}
                      onChange={(e) => updateRow(index, { unitOfMeasure: e.target.value })}
                      disabled={disabled}
                      className={cellInput}
                    >
                      {uomOptions.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.remarks || ""}
                      onChange={(e) => updateRow(index, { remarks: e.target.value })}
                      disabled={disabled}
                      placeholder="Optional"
                      className={cellInput}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      disabled={disabled}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="Remove"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}