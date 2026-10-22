const pad = (n: number) => String(n).padStart(2, "0");

/**
 * yyyy-MM-dd in the user's own timezone. Unlike toISOString(), which is UTC, this doesn't
 * return yesterday's date between midnight and the UTC offset (e.g. 00:00–05:30 in India).
 */
export const toLocalIsoDate = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayIso = (): string => toLocalIsoDate(new Date());
