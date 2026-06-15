import React, { useState } from "react";

type RowData = Record<string, string>;

const ImportExportPage: React.FC = () => {
  const [data, setData] = useState<RowData[]>([]);
  const [fileName, setFileName] = useState<string>("");

  // Parse CSV to JSON
  const parseCSV = (csv: string): RowData[] => {
    const [headerLine, ...lines] = csv.trim().split("\n");
    const headers = headerLine.split(",").map(h => h.trim());
    return lines.map(line => {
      const values = line.split(",");
      const row: RowData = {};
      headers.forEach((h, i) => {
        row[h] = values[i]?.trim() ?? "";
      });
      return row;
    });
  };

  // Import CSV Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = parseCSV(text);
      setData(parsed);
    };
    reader.readAsText(file);
  };

  // Export CSV Handler
  const exportCSV = () => {
    if (data.length === 0) return alert("No data to export.");

    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => `"${row[h] || ""}"`).join(","));
    const csvContent = [headers.join(","), ...rows].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "exported_data.csv";
    link.click();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white border rounded shadow">
      <h2 className="text-2xl font-bold mb-6">📊 Data Import & Export</h2>

      {/* Import Section */}
      <div className="mb-6">
        <h3 className="font-semibold mb-2">Import CSV</h3>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="form-input block w-full"
        />
        {fileName && (
          <p className="mt-2 text-sm text-gray-600">Uploaded: {fileName}</p>
        )}
      </div>

      {/* Export Section */}
      <div className="mb-6">
        <h3 className="font-semibold mb-2">Export CSV</h3>
        <button
          className="btn btn-primary"
          onClick={exportCSV}
          disabled={data.length === 0}
        >
          📤 Export CSV
        </button>
      </div>

      {/* Preview Table */}
      {data.length > 0 && (
        <div className="overflow-x-auto mt-6 border rounded">
          <table className="min-w-full text-sm table-auto">
            <thead className="bg-gray-100">
              <tr>
                {Object.keys(data[0]).map((key) => (
                  <th key={key} className="px-4 py-2 border text-left">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((row, idx) => (
                <tr key={idx} className="border-t">
                  {Object.values(row).map((val, i) => (
                    <td key={i} className="px-4 py-2 border">{val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 10 && (
            <p className="text-xs text-gray-500 mt-2 px-2">
              Showing first 10 rows of {data.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportExportPage;
