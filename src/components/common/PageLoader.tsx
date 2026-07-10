import React from "react";

interface PageLoaderProps {
  message?: string;
  overlay?: boolean;
}

const PageLoader: React.FC<PageLoaderProps> = ({
  message = "Loading page...",
  overlay = false,
}) => {
  return (
    <div
      className={
        overlay
          ? "fixed inset-0 z-[9998] flex items-center justify-center bg-white/30 backdrop-blur-[2px] px-6 py-12"
          : "flex min-h-[320px] w-full items-center justify-center px-6 py-12"
      }
    >
      <div className="flex flex-col items-center gap-4 px-8 py-6 text-center">
        <div className="relative">
          <div className="h-14 w-14 rounded-full border-4 border-cyan-100" />
          <div className="absolute inset-0 h-14 w-14 animate-spin rounded-full border-4 border-transparent border-t-cyan-600 border-r-cyan-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">{message}</p>
          <p className="mt-1 text-xs text-gray-500">
            Please wait while we prepare the page.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PageLoader;
