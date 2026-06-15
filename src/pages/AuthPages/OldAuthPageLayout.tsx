import React, { useEffect, useState } from "react";

import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";
import Image1 from "../../images/image1.png";
import { useTheme } from "../../context/ThemeContext";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme(); // "light" or "dark"
  type WeekDate = { label: string; date: number; month: number; year: number };
  const [weekDates, setWeekDates] = useState<WeekDate[]>([]);

  // Generate week dates for calendar
  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dates = [];

    for (let i = 0; i < 7; i++) {
      const current = new Date(startOfWeek);
      current.setDate(startOfWeek.getDate() + i);
      dates.push({
        label: days[i],
        date: current.getDate(),
        month: current.getMonth(),
        year: current.getFullYear(),
      });
    }
    setWeekDates(dates);
  }, []);

  const todayDate = new Date();
  const rightPanelBg = theme === "light" ? "#66b2b2" : "#1f2937";

  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <div className="relative flex flex-col justify-center w-full h-screen lg:flex-row sm:p-0">

        {/* Left Panel: children (Login/Signup forms) */}
        {children}

        {/* Right Panel */}
        <div
          className="hidden lg:flex flex-col items-center justify-center w-full lg:w-1/2 p-10 relative overflow-hidden shadow-lg text-white"
          style={{ backgroundColor: rightPanelBg }}
        >
          {/* Hero Image */}
          <img
            src={Image1}
            alt="Team Collaboration"
            className="auth-img max-w-[80%] max-h-[80vh] mb-8 select-none pointer-events-none shadow-xl"
          />

          {/* Calendar */}
          <div className="calendar flex justify-between gap-3 mt-5 w-50">
            {weekDates.map((day, index) => {
              const isToday =
                day?.date === todayDate.getDate() &&
                day?.month === todayDate.getMonth() &&
                day?.year === todayDate.getFullYear();

              return (
                <div
                  key={index}
                  className="calendar-day text-center font-medium transition-transform duration-300 hover:scale-110"
                  style={{ color: "white" }}
                >
                  {day?.label}
                  <br />
                  <span
                    className={`calendar-date inline-block mt-2 rounded-full w-9 h-9 leading-9 text-center transition-all duration-300`}
                    style={{
                      backgroundColor: isToday
                        ? theme === "light"
                          ? "#000"
                          : "#fff"
                        : "rgba(255,255,255,0.3)",
                      color: isToday
                        ? theme === "light"
                          ? "#fff"
                          : "#000"
                        : "#fff",
                      fontWeight: isToday ? "bold" : "normal",
                      boxShadow: isToday ? "0 0 8px rgba(0,0,0,0.3)" : "none",
                    }}
                  >
                    {day.date}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Theme Toggler */}
        <div className="fixed z-50 bottom-6 right-6 sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
