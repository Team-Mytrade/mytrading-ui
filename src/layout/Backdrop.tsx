import { useSidebar } from "../context/SidebarContext";

const Backdrop: React.FC = () => {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar();

  return (
    <div
      className={`fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm lg:hidden transition-all duration-300
        ${isMobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      onClick={toggleMobileSidebar}
    />
  );
};

export default Backdrop;
