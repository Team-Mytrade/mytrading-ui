import { useCallback, useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { getSelectedTenant, hasPermission } from "../access/access";
import { useCompany } from "./companyApi";
import { checkSteps, progressOf, setupApi, type SetupStepKey, type SetupView, type StepResult } from "./setupGuide";

/**
 * The guide for the signed-in company's administrator (USERS:ADMIN). A Super Admin sees it only inside a chosen
 * company. Statuses are read when the page opens and after each change.
 */
export const useSetupGuide = ({ onlyWhenShown = false }: { onlyWhenShown?: boolean } = {}) => {
  const { access } = useContext(AuthContext);
  const { company, loading: companyLoading } = useCompany();
  const allowed = hasPermission(access, "USERS:ADMIN") && (!access.superAdmin || !!getSelectedTenant());
  const [setup, setSetup] = useState<SetupView | null>(null);
  const [results, setResults] = useState<Record<SetupStepKey, StepResult> | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!allowed || companyLoading) return;
    setLoading(true);
    let stored: SetupView | null = null;
    try {
      stored = await setupApi.get();
      setFailed(false);
    } catch {
      setFailed(true);
    }
    setSetup(stored);
    // The Command Center banner doesn't ask the services once the guide is put away
    setResults(onlyWhenShown && stored?.dismissed ? null : await checkSteps(access, stored, company));
    setLoading(false);
  }, [allowed, companyLoading, access, company, onlyWhenShown]);

  useEffect(() => {
    load();
  }, [load]);

  const apply = (view: SetupView) => {
    setSetup(view);
    return load();
  };

  return {
    allowed, setup, results, loading: allowed && (loading || companyLoading), failed, progress: progressOf(results), reload: load,
    setStep: async (step: SetupStepKey, state: "DONE" | "SKIPPED" | null) => apply(await setupApi.setStep(step, state)),
    setDismissed: async (dismissed: boolean) => apply(await setupApi.setDismissed(dismissed)),
  };
};
