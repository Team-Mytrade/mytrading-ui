import React, { useMemo } from "react";
import ReusableTable, { ColumnDef } from "./Table";

const labelFor = (key: string) =>
  key.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());

const ReportDataTable = <T extends { id?: number | string }>({ data }: { data: T[] }) => {
  const columns = useMemo<ColumnDef<T>[]>(() => {
    const keys = Array.from(new Set(data.flatMap((row) => Object.keys(row))))
      .filter((key) => key !== "id");
    return keys.map((key) => ({
      key,
      label: labelFor(key),
      sortable: true,
      filterable: true,
      render: (row: T) => {
        const value = (row as Record<string, unknown>)[key];
        if (typeof value === "boolean") return value ? "Yes" : "No";
        if (typeof value === "number") return value.toLocaleString();
        return String(value ?? "--");
      },
    }));
  }, [data]);

  return (
    <div className="report-reusable-table rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <ReusableTable
        data={data}
        columns={columns}
        pageSize={10}
        defaultSortKey="id"
        defaultSortOrder="desc"
        showColumnFiltersInitially
        enableRowDetails={false}
      />
    </div>
  );
};

export default ReportDataTable;
