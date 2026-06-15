import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { ToasterService } from "../../Services/ToasterService";
import './SignUp.css';


const roles = [
  "ADMIN",
  "DISTRIBUTOR",
  "SALES",
  "CUSTOMER",
  "WAREHOUSE_STAFF",
  "FINANCE_OFFICER",
  "MANAGER",
];

const SignUpForm = () => {
  const { signup } = useContext(AuthContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    role: '',
    email: '',
    password: '',
    agree: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [passwordErrors, setPasswordErrors] = useState({
    length: false,
    uppercase: false,
    number: false,
    specialChar: false,
  });

  // Password validation function
  const validatePassword = (password: string) => {
    const newErrors = {
      length: password.length < 8,
      uppercase: !/[A-Z]/.test(password),
      number: !/[0-9]/.test(password),
      specialChar: !/[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    setPasswordErrors(newErrors);
    return !Object.values(newErrors).some(Boolean);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    const updatedValue = type === 'checkbox' ? checked : value;

    setFormData({
      ...formData,
      [name]: updatedValue,
    });

    if (name === 'password') validatePassword(value);
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Full Name is required.';
    if (!formData.role) newErrors.role = 'Role is required.';
    if (!formData.email.trim()) newErrors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = 'Please enter a valid email.';
    if (!formData.password) newErrors.password = 'Password is required.';
    else if (!validatePassword(formData.password))
      newErrors.password = 'Please create a stronger password.';
    if (!formData.agree)
      newErrors.agree = 'You must agree to the terms and conditions.';
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      ToasterService.error("Please fix the errors in the form.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const result = await signup(
        formData.fullName,
        formData.role,
        formData.email,
        formData.password
      );

      if (result) {
        ToasterService.success("Signup successful!");
        navigate("/signin");
      } else {
        ToasterService.error(result?.message || "Signup failed!");
      }
    } catch (err) {
      console.error(err);
      ToasterService.error("Signup failed!");
    }
  };

  return (
    <div className="auth-left min-h-screen bg-gray-50 dark:bg-gray-900 overflow-y-auto flex justify-center items-center p-10 no-scrollbar">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-10 space-y-6">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white text-center">
          Sign Up
        </h1>
        <p className="text-center text-gray-500 dark:text-gray-300 mb-6">
          Create your account to get started!
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name & Role */}
          <div className="form-row flex flex-col sm:flex-row gap-4">
            <div className="form-group flex-1">
              <label className="text-gray-700 dark:text-gray-200">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="fullName"
                placeholder="John Doe"
                className={`form-control w-full px-4 py-3 rounded-lg border 
                  ${errors.fullName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} 
                  focus:ring-2 focus:ring-teal-400 dark:focus:ring-teal-500`}
                value={formData.fullName}
                onChange={handleChange}
              />
              <div className="min-h-[20px] mt-1">
                {errors.fullName && <small className="text-red-500">{errors.fullName}</small>}
              </div>
            </div>

            <div className="form-group flex-1">
              <label className="text-gray-700 dark:text-gray-200">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                name="role"
                className={`form-control w-full px-4 py-3 rounded-lg border 
                  ${errors.role ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} 
                  focus:ring-2 focus:ring-teal-400 dark:focus:ring-teal-500`}
                value={formData.role}
                onChange={handleChange}
              >
                <option value="">Select Role</option>
                {roles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <div className="min-h-[20px] mt-1">
                {errors.role && <small className="text-red-500">{errors.role}</small>}
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="text-gray-700 dark:text-gray-200">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="text" // Changed from type="email" to "text" to disable HTML email validation
              name="email"
              placeholder="you@example.com"
              className={`form-control w-full px-4 py-3 rounded-lg border 
                ${errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} 
                focus:ring-2 focus:ring-teal-400 dark:focus:ring-teal-500`}
              value={formData.email}
              onChange={handleChange}
            />
            <div className="min-h-[20px] mt-1">
              {errors.email && <small className="text-red-500">{errors.email}</small>}
            </div>
          </div>

          {/* Password */}
          <div className="form-group password-group">
            <label className="text-gray-700 dark:text-gray-200">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="password-wrapper relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Your Password"
                className={`form-control w-full px-4 py-3 rounded-lg border 
                  ${errors.password ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} 
                  focus:ring-2 focus:ring-teal-400 dark:focus:ring-teal-500`}
                value={formData.password}
                onChange={handleChange}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-teal-500 focus:outline-none"
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-lg`}></i>
              </button>
            </div>

            <div className="min-h-[20px] mt-1">
              {errors.password && <small className="text-red-500">{errors.password}</small>}
            </div>
            {/* Password strength */}
            <div className="min-h-[80px]">
              {Object.values(passwordErrors).some(Boolean) && (
                <ul className="mt-2 ml-2 text-xs text-red-500 space-y-1">
                  {passwordErrors.length && <li>Minimum 8 characters</li>}
                  {passwordErrors.uppercase && <li>At least 1 uppercase letter</li>}
                  {passwordErrors.number && <li>At least 1 number</li>}
                  {passwordErrors.specialChar && <li>At least 1 special character</li>}
                </ul>
              )}
            </div>
          </div>

          {/* Terms and Conditions & Privacy Policy */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="agree"
              checked={formData.agree}
              onChange={handleChange}
              className="form-checkbox h-4 w-4 text-teal-500"
            />
            <label className="text-gray-700 dark:text-gray-200 text-sm">
              By creating an account you agree to the{" "}
              <Link to="/terms" className="text-teal-500 hover:text-teal-400">
                terms and conditions
              </Link>{" "}
              and our{" "}
              <Link to="/privacy-policy" className="text-teal-500 hover:text-teal-400">
                privacy policy
              </Link>.
            </label>
          </div>
          <div className="min-h-[20px] mt-1">
            {errors.agree && <small className="text-red-500">{errors.agree}</small>}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-teal-500 to-teal-600 
              hover:from-teal-600 hover:to-teal-700 text-white font-bold 
              rounded-lg shadow-lg transition-all duration-300 focus:outline-none"
          >
            Sign Up
          </button>
        </form>

        {/* Footer */}
        <div className="auth-footer mt-6 text-center text-gray-500 dark:text-gray-300 space-y-1">
          <p>
            Already have an account?{" "}
            <Link to="/signin" className="text-teal-500 hover:text-teal-400">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUpForm;
