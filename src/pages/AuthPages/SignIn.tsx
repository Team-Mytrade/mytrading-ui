import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

import { t } from "../../i18n/i18n";
export default function SignIn() {
  return (
    <>
      <PageMeta
        title={t("Sign In | myTrading")}
        description="Sign in to myTrading"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
