import axios from 'axios';

export interface EnumItem {
  code: string;
  label: string;
}

const ENUM_API_BASE = '/v1/api/attendance/enums';

// In-memory cache to avoid redundant HTTP requests
const enumCache: Record<string, EnumItem[]> = {};

export const fetchAttendanceEnums = async (
  type: string,
  fallbackOptions: EnumItem[] = []
): Promise<EnumItem[]> => {
  if (enumCache[type] && enumCache[type].length > 0) {
    return enumCache[type];
  }

  try {
    const token = localStorage.getItem('accessToken');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await axios.get(ENUM_API_BASE, {
      params: { type },
      headers,
      timeout: 5000,
    });

    if (Array.isArray(response.data) && response.data.length > 0) {
      const mapped: EnumItem[] = response.data.map((item: any) => ({
        code: typeof item === 'string' ? item : item.code || item.value || String(item),
        label: typeof item === 'string' ? item : item.label || item.name || item.code || String(item),
      }));
      enumCache[type] = mapped;
      return mapped;
    }
  } catch (err) {
    console.warn(`Could not fetch attendance enum for type '${type}'. Using fallback options.`, err);
  }

  return fallbackOptions;
};
