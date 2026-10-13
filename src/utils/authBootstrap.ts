export const AUTH_BOOTSTRAP_COMPLETE_EVENT = "app-auth-bootstrap-complete";

let complete = false;

/**
 * Startup sign-in check finished. Kept as a flag as well as an event: the check can finish before
 * a listener is attached (child effects run before their parent's), and a missed event left the
 * "Loading your page..." overlay covering the app for good.
 */
export const markAuthBootstrapComplete = () => {
  complete = true;
  window.dispatchEvent(new Event(AUTH_BOOTSTRAP_COMPLETE_EVENT));
};

export const isAuthBootstrapComplete = () => complete;
