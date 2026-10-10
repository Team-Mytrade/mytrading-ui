import type { SyntheticEvent } from "react";

/**
 * onError handler that swaps in a fallback image once. Setting src in every onError loops forever
 * when the fallback itself cannot load.
 */
export const imageFallback = (fallback: string) => (event: SyntheticEvent<HTMLImageElement>) => {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === "true") {
    img.onerror = null;
    return;
  }
  img.dataset.fallbackApplied = "true";
  img.src = fallback;
};
