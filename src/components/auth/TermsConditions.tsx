import { Link, useNavigate } from 'react-router-dom';

const TermsAndConditions = () => {
  const navigate = useNavigate();

  const handleClose = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/20 to-slate-100 dark:from-gray-950 dark:via-teal-950/10 dark:to-gray-900 flex flex-col relative overflow-hidden font-sans">
      
      {/* Dynamic Background Blur Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-teal-400/10 dark:bg-teal-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-400/10 dark:bg-emerald-500/5 blur-[140px] pointer-events-none" />

      {/* Header Bar */}
      <header className="relative z-10 max-w-7xl mx-auto w-full px-6 pt-8 pb-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <i className="fas fa-file-signature text-white text-lg"></i>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-400 dark:to-emerald-400 bg-clip-text text-transparent">
            My Trading
          </span>
        </div>

        {/* Circular Premium Close Button */}
        <button
          onClick={handleClose}
          aria-label="Go Back"
          className="h-11 w-11 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:border-teal-500/30 dark:hover:border-teal-400/30 shadow-sm hover:shadow-md transform hover:rotate-90 transition-all duration-300"
        >
          <i className="fas fa-times text-lg"></i>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-grow relative z-10 max-w-4xl mx-auto w-full px-6 py-12 flex flex-col items-center">
        
        {/* Intro Header */}
        <div className="text-center max-w-2xl mb-12">
          <span className="px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider text-teal-700 dark:text-teal-300 bg-teal-500/10 dark:bg-teal-500/20 uppercase">
            Legal Agreement
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-gray-950 dark:text-white mt-4 tracking-tight leading-tight">
            Terms & Conditions
          </h1>
          <p className="mt-4 text-base md:text-lg text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
            By using our website and services, you agree to these Terms and Conditions. Please read them carefully.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-12">
          
          {/* Card 1 */}
          <div className="group bg-white/70 dark:bg-gray-800/40 backdrop-blur-md border border-white/40 dark:border-gray-700/30 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-teal-500/30 dark:hover:border-teal-400/30 transform hover:-translate-y-1 transition-all duration-300">
            <div className="h-12 w-12 rounded-2xl bg-teal-50 dark:bg-teal-950/40 flex items-center justify-center text-teal-600 dark:text-teal-400 group-hover:bg-gradient-to-tr group-hover:from-teal-500 group-hover:to-emerald-500 group-hover:text-white transition-all duration-300 shadow-inner mb-5">
              <i className="fas fa-file-contract text-xl"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
              1. Acceptance of Terms
            </h3>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
              By accessing or using our website, you agree to comply with these Terms and Conditions and all applicable laws and regulations.
            </p>
          </div>

          {/* Card 2 */}
          <div className="group bg-white/70 dark:bg-gray-800/40 backdrop-blur-md border border-white/40 dark:border-gray-700/30 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-teal-500/30 dark:hover:border-teal-400/30 transform hover:-translate-y-1 transition-all duration-300">
            <div className="h-12 w-12 rounded-2xl bg-teal-50 dark:bg-teal-950/40 flex items-center justify-center text-teal-600 dark:text-teal-400 group-hover:bg-gradient-to-tr group-hover:from-teal-500 group-hover:to-emerald-500 group-hover:text-white transition-all duration-300 shadow-inner mb-5">
              <i className="fas fa-sync-alt text-xl"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
              2. Changes to Terms
            </h3>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
              We reserve the right to modify these Terms at any time. Please check this page periodically for updates and standard layout improvements.
            </p>
          </div>

          {/* Card 3 */}
          <div className="group bg-white/70 dark:bg-gray-800/40 backdrop-blur-md border border-white/40 dark:border-gray-700/30 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-teal-500/30 dark:hover:border-teal-400/30 transform hover:-translate-y-1 transition-all duration-300">
            <div className="h-12 w-12 rounded-2xl bg-teal-50 dark:bg-teal-950/40 flex items-center justify-center text-teal-600 dark:text-teal-400 group-hover:bg-gradient-to-tr group-hover:from-teal-500 group-hover:to-emerald-500 group-hover:text-white transition-all duration-300 shadow-inner mb-5">
              <i className="fas fa-user-shield text-xl"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
              3. User Responsibilities
            </h3>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
              You are responsible for your own actions while using our services. You agree to not engage in any unlawful activity or misuse the system.
            </p>
          </div>

          {/* Card 4 */}
          <div className="group bg-white/70 dark:bg-gray-800/40 backdrop-blur-md border border-white/40 dark:border-gray-700/30 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-teal-500/30 dark:hover:border-teal-400/30 transform hover:-translate-y-1 transition-all duration-300">
            <div className="h-12 w-12 rounded-2xl bg-teal-50 dark:bg-teal-950/40 flex items-center justify-center text-teal-600 dark:text-teal-400 group-hover:bg-gradient-to-tr group-hover:from-teal-500 group-hover:to-emerald-500 group-hover:text-white transition-all duration-300 shadow-inner mb-5">
              <i className="fas fa-shield-alt text-xl"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
              4. Limitation of Liability
            </h3>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
              Our liability is limited to the extent allowed by law. We are not responsible for any indirect, incidental, or consequential damages.
            </p>
          </div>

        </div>

        {/* Primary Interactive CTA */}
        <button
          onClick={handleClose}
          className="w-full max-w-[280px] h-[46px] bg-gradient-to-r from-teal-500 via-teal-600 to-emerald-600 hover:from-teal-600 hover:via-teal-700 hover:to-emerald-700 text-white !text-white font-extrabold rounded-2xl shadow-lg shadow-teal-500/20 hover:shadow-teal-600/40 transform hover:-translate-y-0.5 transition-all duration-300 group relative flex items-center justify-center"
        >
          <span className="text-white !text-white tracking-wider uppercase text-xs font-extrabold text-center">
            I Agree & Accept
          </span>
          <i className="fas fa-check text-xs text-white !text-white absolute right-4 transform group-hover:scale-110 transition-transform duration-200"></i>
        </button>

      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-200/50 dark:border-gray-800/50 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md py-6 w-full mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            &copy; {new Date().getFullYear()} My Trading. All Rights Reserved.
          </p>
          <div className="flex gap-6">
            <Link to="/privacypolicy" className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/contactus" className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default TermsAndConditions;
