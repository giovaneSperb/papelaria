import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Home from "./pages/Home.jsx";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center">Carregando…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center">Carregando…</div>;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/cadastro" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
