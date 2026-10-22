import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import ResetPasswordForm from "../../components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <>
      <PageMeta title="Reset Password" description="Choose a new password using the link from your email." />
      <AuthLayout>
        <ResetPasswordForm />
      </AuthLayout>
    </>
  );
}
