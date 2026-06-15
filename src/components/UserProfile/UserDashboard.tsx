import React, { useState } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  People, Person, Inventory2, Brightness4, Brightness7
} from "@mui/icons-material";

// Menu Items
const menuItems = [
  { name: "Users", icon: <People className="text-white text-3xl" />, gradient: "from-blue-500 to-indigo-500" },
  { name: "Employees", icon: <Person className="text-white text-3xl" />, gradient: "from-green-500 to-emerald-500" },
  { name: "Products", icon: <Inventory2 className="text-white text-3xl" />, gradient: "from-yellow-500 to-orange-500" },
];

// KPIs
const kpis = [
  { label: "Total Users", value: 250, gradient: "from-blue-500 to-indigo-500" },
  { label: "Active Employees", value: 120, gradient: "from-green-500 to-emerald-500" },
  { label: "Total Products", value: 320, gradient: "from-yellow-500 to-orange-500" },
  { label: "Products in Stock", value: 280, gradient: "from-purple-500 to-pink-500" },
];

// Mock Chart Data
const userTrendData = [
  { day: "Mon", users: 20 },
  { day: "Tue", users: 25 },
  { day: "Wed", users: 18 },
  { day: "Thu", users: 30 },
  { day: "Fri", users: 22 },
];

const productStockData = [
  { product: "SKU A", stock: 120 },
  { product: "SKU B", stock: 80 },
  { product: "SKU C", stock: 150 },
  { product: "SKU D", stock: 60 },
];

const UserDashboard: React.FC = () => {
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen dark:bg-gray-900 p-4 transition-colors duration-300">

        {/* Dark Mode Toggle */}
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 transition"
          >
            {darkMode ? <Brightness7 /> : <Brightness4 />}
          </button>
        </div>

        {/* Menu Cards */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar mb-4 py-2">
          {menuItems.map((item) => (
            <motion.div
              key={item.name}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`min-w-[140px] rounded-xl p-3 text-white bg-gradient-to-br ${item.gradient} shadow-md`}
            >
              <div className="flex justify-center mb-2">{item.icon}</div>
              <p className="text-sm font-semibold text-center">{item.name}</p>
            </motion.div>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {kpis.map((kpi) => (
            <motion.div
              key={kpi.label}
              whileHover={{ scale: 1.03 }}
              className={`p-4 rounded-xl text-white bg-gradient-to-br ${kpi.gradient} shadow-md`}
            >
              <p className="text-xs font-semibold">{kpi.label}</p>
              <h2 className="text-lg font-bold">{kpi.value}</h2>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* User Trend */}
          <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <h3 className="text-sm font-semibold dark:text-white mb-2">User Registration Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={userTrendData}>
                <Line type="monotone" dataKey="users" stroke="#4f46e5" strokeWidth={2} />
                <XAxis dataKey="day" stroke="#999" />
                <YAxis stroke="#999" />
                <Tooltip />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Product Stock */}
          <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <h3 className="text-sm font-semibold dark:text-white mb-2">Product Stock Levels</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={productStockData}>
                <Bar dataKey="stock" fill="#10b981" />
                <XAxis dataKey="product" stroke="#999" />
                <YAxis stroke="#999" />
                <Tooltip />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>

      </div>
    </div>
  );
};

export default UserDashboard;
