/** Resolve a file from `public` against Vite's configured deployment base. */
export const publicAsset = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
