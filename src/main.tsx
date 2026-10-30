import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import "./styles/rtl.css";
// Sets the page's language and direction before the first render
import "./i18n/i18n";
import "swiper/swiper-bundle.css";
import "simplebar-react/dist/simplebar.min.css";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import AppPreloader from "./components/common/AppPreloader.tsx";
import PageLoader from "./components/common/PageLoader.tsx";

import { AUTH_BOOTSTRAP_COMPLETE_EVENT, isAuthBootstrapComplete } from "./utils/authBootstrap";
import { applyRememberedBrand } from "./company/brand";

// The company's colour from the last visit, before the first paint
applyRememberedBrand();

// The browser's calendar / clock icon is hidden app-wide (index.css), and Chrome only opens the picker from
// that icon, so clicking a date or time field did nothing. Open the picker on any click on such a field.
const PICKER_TYPES = new Set(["date", "time", "month", "week", "datetime-local"]);
document.addEventListener("click", (event) => {
  const field = event.target;
  if (!(field instanceof HTMLInputElement) || !PICKER_TYPES.has(field.type) || field.disabled || field.readOnly) return;
  try {
    field.showPicker?.();
  } catch {
    /* already open, or not allowed in this frame */
  }
});

const LOGIN_PRELOADER_SHOWN_KEY = "loginPreloaderShown";
const LOGIN_SUCCESS_EVENT = "app-login-success";

function Root() {
  const hasStoredSession = !!localStorage.getItem("accessToken");
  const shouldShowInitially =
    hasStoredSession &&
    localStorage.getItem(LOGIN_PRELOADER_SHOWN_KEY) !== "true";
  const shouldShowBootstrapLoader =
    hasStoredSession &&
    localStorage.getItem(LOGIN_PRELOADER_SHOWN_KEY) === "true";

  const [loading, setLoading] = useState(shouldShowInitially);
  const [bootstrapping, setBootstrapping] = useState(shouldShowBootstrapLoader);

  const handleFinished = () => {
    localStorage.setItem(LOGIN_PRELOADER_SHOWN_KEY, "true");
    setLoading(false);
  };

  React.useEffect(() => {
    const handleLoginSuccess = () => {
      if (localStorage.getItem(LOGIN_PRELOADER_SHOWN_KEY) === "true") {
        return;
      }

      setLoading(true);
      setBootstrapping(false);
    };

    const handleBootstrapComplete = () => {
      setBootstrapping(false);
    };

    window.addEventListener(LOGIN_SUCCESS_EVENT, handleLoginSuccess);
    window.addEventListener(AUTH_BOOTSTRAP_COMPLETE_EVENT, handleBootstrapComplete);
    // The check may already have finished before this listener existed
    if (isAuthBootstrapComplete()) {
      handleBootstrapComplete();
    }

    return () => {
      window.removeEventListener(LOGIN_SUCCESS_EVENT, handleLoginSuccess);
      window.removeEventListener(AUTH_BOOTSTRAP_COMPLETE_EVENT, handleBootstrapComplete);
    };
  }, []);

  return (
    <>
      {loading && <AppPreloader onFinished={handleFinished} />}
      {bootstrapping && !loading && (
        <PageLoader message="Loading your page..." overlay />
      )}
      <ThemeProvider>
        <AppWrapper>
          <App />
        </AppWrapper>
      </ThemeProvider>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  // <StrictMode>
    <Root />
  // </StrictMode>
);
