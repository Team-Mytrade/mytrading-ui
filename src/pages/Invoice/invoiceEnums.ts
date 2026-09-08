import { useEffect, useState } from "react";
import axios from "axios";

export interface InvoiceEnumOption {
  code: string;
  label: string;
}

const ENUM_API_URL = "/v1/api/invoice/enums";

export function useInvoiceEnum(type: string, fallback: string[]): InvoiceEnumOption[] {
  const [options, setOptions] = useState<InvoiceEnumOption[]>(() =>
    fallback.map((code) => ({ code, label: formatEnumLabel(code) }))
  );

  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem("accessToken");
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    axios
      .get<InvoiceEnumOption[]>(ENUM_API_URL, { headers, params: { type } })
      .then(({ data }) => {
        if (!isMounted || !Array.isArray(data) || !data.length) return;
        setOptions(
          data
            .filter((option) => option?.code)
            .map((option) => ({ code: option.code, label: option.label || formatEnumLabel(option.code) }))
        );
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [type]);

  return options;
}

export function formatEnumLabel(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function toSelectOptions(options: InvoiceEnumOption[]) {
  return options.map(({ code, label }) => ({ id: code, name: label }));
}

export function toFilterOptions(options: InvoiceEnumOption[]) {
  return options.map(({ code, label }) => ({ value: code, label }));
}
