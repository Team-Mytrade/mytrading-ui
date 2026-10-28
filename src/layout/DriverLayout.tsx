import { Suspense, useContext, useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { AuthContext } from "../context/AuthContext";
import { canAccessPath } from "../access/access";
import NoAccess from "../access/NoAccess";
import SignIn from "../pages/AuthPages/SignIn";
import PageLoading from "../components/common/PageLoading";
import { saveReturnPath } from "../utils/sessionRecovery";
import { useRegionalVersion } from "../company/companyApi";

// Full-screen layout for the driver's phone: no sidebar or header, same sign-in and access rules as the app
const DriverLayout: React.FC = () => {
  const { isLoggedIn, loading, access } = useContext(AuthContext);
  const location = useLocation();
  const regional = useRegionalVersion(isLoggedIn);

  // Come back here after signing in
  useEffect(() => {
    if (!loading && !isLoggedIn) saveReturnPath();
  }, [loading, isLoggedIn]);

  if (loading) return <PageLoading />;
  if (!isLoggedIn) return <SignIn />;
  if (!canAccessPath(access, location.pathname)) return <NoAccess />;
  if (!regional.ready) return <PageLoading />;

  return (
    <Suspense key={regional.version} fallback={<PageLoading />}>
      <Outlet />
    </Suspense>
  );
};

export default DriverLayout;
