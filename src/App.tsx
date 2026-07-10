import { AuthProvider } from "./context/AuthContext";
import AppRouter from "./Router";

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
