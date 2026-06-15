import React from "react";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";
import ParticleBackground from "../../components/common/ParticleBackground";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-gray-950 dark:to-cyan-900 p-4 sm:p-6 overflow-hidden">
      {/* 3D Particle Background */}
      <ParticleBackground />

      {/* Abstract Background Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 mix-blend-multiply dark:mix-blend-overlay">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-cyan-400/30 dark:bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-sky-400/30 dark:bg-sky-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full flex justify-center items-center">
        {children}
      </div>

      {/* Theme Toggler */}
      <div className="fixed z-50 bottom-6 right-6 sm:block">
        <ThemeTogglerTwo />
      </div>
    </div>
  );
}
