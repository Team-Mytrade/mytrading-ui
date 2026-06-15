import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

interface FormErrors {
  email?: string;
}

const ForgetPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [timer, setTimer] = useState(60);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [timerInterval, setTimerInterval] = useState<number | null>(null);

  interface ChangeEvent {
    target: {
      value: string;
    };
  }

  const handleChange = (e: ChangeEvent): void => {
    const { value } = e.target;
    setEmail(value);
    // Clear email error when user starts typing
    if (errors.email) {
      setErrors(prev => ({ ...prev, email: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};
    if (!email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    if (!validateForm()) {
      setIsLoading(false);
      return;
    }

    try {
      const url = `/v1/api/auth/forgot_username?username=${encodeURIComponent(email)}`;
      console.log("Making API call to:", url);

      const response = await fetch(url, {
        method: 'GET',
      });

      console.log("Response status:", response.status);

      if (response.ok) {
        console.log("✅ OTP sent successfully!");
        setIsOtpSent(true);
        setErrors({});
      } else {
        try {
          const errorText = await response.text();
          console.log("Error response text:", errorText);

          let errorMessage = 'Failed to send OTP';
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorMessage;
          } catch {
            errorMessage = errorText || response.statusText || errorMessage;
          }

          setErrors({ email: errorMessage });
        } catch (parseError) {
          console.error("Error parsing error response:", parseError);
          setErrors({ email: `Failed to send OTP (Status: ${response.status})` });
        }
      }

    } catch (error) {
      console.error("Network error:", error);
      setErrors({ email: 'Network error. Please check your connection and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const startTimer = () => {
    // Clear any existing timer
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    setTimer(60);
    const interval = window.setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          navigate("/signin");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setTimerInterval(interval);
  };

  useEffect(() => {
    if (isOtpSent) {
      startTimer();
    }

    // Cleanup timer on component unmount
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [isOtpSent]);

  // Cleanup timer when component unmounts
  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [timerInterval]);

  return (
    <div className="auth-left min-h-screen bg-gray-50 dark:bg-gray-900 overflow-y-auto flex justify-center items-center p-10 no-scrollbar">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-10 space-y-6">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white text-center">
          Forgot Password
        </h1>
        <p className="text-center text-gray-500 dark:text-gray-300 mb-6">
          Enter your email to reset your password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Field */}
          <div className="form-group">
            <label className="text-gray-700 dark:text-gray-200">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              className={`form-control w-full px-4 py-3 rounded-lg border 
                ${errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} 
                focus:ring-2 focus:ring-teal-400 dark:focus:ring-teal-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
              value={email}
              onChange={handleChange}
              disabled={isOtpSent}
            />
            {errors.email && (
              <small className={`text-red-500 ${errors.email.includes('OTP may have been sent') ? 'text-orange-500' : 'text-red-500'}`}>
                {errors.email}
              </small>
            )}
          </div>

          {/* Success Message */}
          {isOtpSent && (
            <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded dark:bg-green-900 dark:border-green-700 dark:text-green-300">
              ✅ OTP has been sent successfully to your email! Please check your inbox.
            </div>
          )}

          {/* Timer Display */}
          {isOtpSent && (
            <div className="flex justify-center items-center space-x-2">
              <span className="text-gray-700 dark:text-gray-300">
                Redirecting to login in:
              </span>
              <span className="font-bold text-teal-600 dark:text-teal-400">{timer}s</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className={`w-full py-3 bg-gradient-to-r from-teal-500 to-teal-600 
              hover:from-teal-600 hover:to-teal-700 text-white font-bold 
              rounded-lg shadow-lg transition-all duration-300
              ${(!email || isLoading || isOtpSent) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl'}`}
            disabled={!email || isLoading || isOtpSent}
          >
            {isLoading ? 'Sending OTP...' : (isOtpSent ? 'OTP Sent Successfully' : 'Send OTP')}
          </button>
        </form>

        {/* Footer Section */}
        <div className="auth-footer mt-6 text-center text-gray-500 dark:text-gray-300 space-y-2">
          <p>Remember your password? <Link to="/signin" className="text-teal-500 hover:text-teal-400 font-medium">Login</Link></p>
        </div>
      </div>
    </div>
  );
};

export default ForgetPassword;