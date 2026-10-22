import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Sign In | myTrading"
        description="Sign in to myTrading"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
