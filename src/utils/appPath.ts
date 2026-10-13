// The app is served below Vite's base path (e.g. /myTrading/). The router uses it as basename;
// raw browser navigation (window.location) must add it too, or it leaves the app.
export const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/+$/, "") || "/";

export const appUrl = (path: string): string =>
  `${ROUTER_BASENAME === "/" ? "" : ROUTER_BASENAME}${path.startsWith("/") ? path : `/${path}`}`;
