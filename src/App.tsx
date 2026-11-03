import { AuthProvider } from "./context/AuthContext";
import AppRouter from "./Router";
import SelectSearch from "./components/common/SelectSearch";

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
      {/* Every dropdown gets a search box when opened */}
      <SelectSearch />
    </AuthProvider>
  );
}
