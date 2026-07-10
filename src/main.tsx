import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "swiper/swiper-bundle.css";
import "simplebar-react/dist/simplebar.min.css";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import AppPreloader from "./components/common/AppPreloader.tsx";
import PageLoader from "./components/common/PageLoader.tsx";

const LOGIN_PRELOADER_SHOWN_KEY = "loginPreloaderShown";
const LOGIN_SUCCESS_EVENT = "app-login-success";
const AUTH_BOOTSTRAP_COMPLETE_EVENT = "app-auth-bootstrap-complete";

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
