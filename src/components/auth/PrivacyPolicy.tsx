
import { Link, useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  // Function to handle the close action (navigate away)
  const handleClose = () => {
    navigate(-1); // Goes back to the previous page
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col relative">

      {/* Close Button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 text-2xl text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300"
      >
        &times;
      </button>

      {/* Main Content */}
      <div className="flex-grow w-full">
        <div className="bg-white dark:bg-gray-800 py-16 px-4 sm:px-6 lg:px-8 w-full">
          <div className="text-center max-w-screen-xl mx-auto">
            <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white">
              Privacy Policy
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your information.
            </p>

            <div className="mt-8 text-left text-gray-600 dark:text-gray-300">
              <h3 className="text-2xl font-semibold text-teal-600 dark:text-teal-400">1. Introduction</h3>
              <p className="mt-2">
                This Privacy Policy describes how we handle your personal information when you use our website and services.
              </p>

              <h3 className="text-2xl font-semibold text-teal-600 dark:text-teal-400 mt-6">2. Information We Collect</h3>
              <p className="mt-2">
                We collect personal data that you provide to us directly, such as your name, email address, and other information when you interact with our services.
              </p>

              <h3 className="text-2xl font-semibold text-teal-600 dark:text-teal-400 mt-6">3. How We Use Your Information</h3>
              <p className="mt-2">
                We use your personal information to provide services to you, respond to your inquiries, and improve our services.
              </p>

              <h3 className="text-2xl font-semibold text-teal-600 dark:text-teal-400 mt-6">4. Data Security</h3>
              <p className="mt-2">
                We implement security measures to protect your information. However, no method of transmission over the internet is 100% secure.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-teal-600 dark:bg-teal-800 py-6 w-full">
        <div className="text-center text-white">
          <p>&copy; {new Date().getFullYear()} Company Name. All Rights Reserved.</p>
          <div className="mt-4">
            <Link to="/contactus" className="text-teal-200 hover:text-teal-100 mx-4">
              Contact Us
            </Link>
            <Link to="/termsandconditions" className="text-teal-200 hover:text-teal-100 mx-4">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default PrivacyPolicy;
