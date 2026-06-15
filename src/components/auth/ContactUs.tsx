
import { Link, useNavigate } from 'react-router-dom';

const ContactUs = () => {
  const navigate = useNavigate(); // Hook for navigation

  // Function to handle the close action (navigate away)
  const handleClose = () => {
    navigate(-1); // Goes back to the previous page
    // Alternatively, you can use navigate('/') to redirect to the homepage
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
              Contact Us
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              We're here to help! Get in touch with us for any questions or inquiries.
            </p>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Contact Info */}
              <div className="flex flex-col items-center">
                <h3 className="text-xl font-semibold text-teal-600 dark:text-teal-400">
                  Address
                </h3>
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                  1234 Main Street, City, Country
                </p>
              </div>
              <div className="flex flex-col items-center">
                <h3 className="text-xl font-semibold text-teal-600 dark:text-teal-400">
                  Phone
                </h3>
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                  +1 (234) 567-8901
                </p>
              </div>
              <div className="flex flex-col items-center">
                <h3 className="text-xl font-semibold text-teal-600 dark:text-teal-400">
                  Email
                </h3>
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                  support@company.com
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-teal-600 dark:bg-teal-800 py-6 w-full">
        <div className="text-center text-white">
          <p>&copy; {new Date().getFullYear()} Company Name. All Rights Reserved.</p>
          <div className="mt-4">
            <Link to="/privacypolicy" className="text-teal-200 hover:text-teal-100 mx-4">
              Privacy Policy
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

export default ContactUs;
