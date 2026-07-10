import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { restoreSessionExpiredDraft } from "../../utils/sessionRecovery";

export default function SessionDraftRestorer() {
  const location = useLocation();

  useEffect(() => {
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    restoreSessionExpiredDraft(currentPath);
  }, [location.pathname, location.search, location.hash]);

  return null;
}
