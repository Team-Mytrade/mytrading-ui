import PageMeta from "../../components/common/PageMeta";  
import AuthLayout from "./AuthPageLayout";  
import ForgetPassword from "../../components/auth/ForgetPassword";

export default function Forget() {
  return (
    <>
      <PageMeta
        title="Forgot Password"
        description="Enter your email address to receive a password reset link."
      />
      <AuthLayout>
        <ForgetPassword/>  
      </AuthLayout>
    </>
  );
}
