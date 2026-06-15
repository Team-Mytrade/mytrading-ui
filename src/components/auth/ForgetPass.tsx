import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ToasterService } from "../../Services/ToasterService";
import '@fortawesome/fontawesome-free/css/all.min.css';

const ForgetPass = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ email?: string }>({});

  // Validate Email format
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Validate form and set errors
  const validateForm = () => {
    const newErrors: { email?: string } = {};
    if (!email.trim()) newErrors.email = 'Email is required.';
    else if (!validateEmail(email)) newErrors.email = 'Please enter a valid email.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission for Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      ToasterService.error("Please fix the errors in the form.");
      return;
    }

    try {
      // Simulate sending a reset link or code
      // You should call your actual API here
      ToasterService.success("A password reset link has been sent to your email!");
      navigate('/signin');
    } catch (err) {
      console.error(err);
      ToasterService.error("Error while sending password reset link.");
    }
  };

  return (
    <div className="auth-left flex justify-center items-center bg-gray-50 dark:bg-gray-900 min-h-screen p-4 no-scrollbar">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-10 space-y-6">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white text-center mb-2">
          Forgot Password
        </h1>
        <p className="text-center text-gray-500 dark:text-gray-300">
          Enter your email address below to receive a password reset link.
        </p>

        <form onSubmit={handleForgotPassword} className="space-y-4" noValidate>
          {/* Email */}
          <div className="form-group">
            <label className="text-gray-700 dark:text-gray-200">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              className={`form-control w-full px-4 py-3 rounded-lg border ${errors.email ? 'border-red-500' : 'border-gray-300'} dark:border-gray-600 focus:ring-2 focus:ring-teal-400 dark:focus:ring-teal-500`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <small className="error-text text-red-500">{errors.email}</small>}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-bold rounded-lg shadow-lg transition-all duration-300"
          >
            Send Reset Link
          </button>
        </form>

        {/* Footer */}
        <div className="auth-footer mt-6 text-center text-gray-500 dark:text-gray-300 space-y-1">
          <p>
            Remember your password?{" "}
            <Link to="/signin" className="text-teal-500 hover:text-teal-400">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgetPass;
