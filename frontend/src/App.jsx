import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Stock from "./pages/Stock.jsx";
import Sale from "./pages/Sale.jsx";
import Customers from "./pages/Customers.jsx";
import Settings from "./pages/Settings.jsx";
import Receipt from "./pages/Receipt.jsx";
import Term from "./pages/Term.jsx";
import CashClosing from "./pages/CashClosing.jsx";
import ClosingPrint from "./pages/ClosingPrint.jsx";
import Users from "./pages/Users.jsx";

// Tela que abre ao entrar no sistema
export const HOME = "/venda";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center">Carregando…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

// Telas só de administrador (operador volta para a venda)
function AdminRoute({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to={HOME} replace />;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center">Carregando…</div>;
  return user ? <Navigate to={HOME} replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="/" element={<Navigate to={HOME} replace />} />
        <Route path="/venda" element={<Sale />} />
        <Route path="/estoque" element={<Stock />} />
        <Route path="/clientes" element={<Customers />} />
        <Route path="/caixa" element={<CashClosing />} />
        <Route path="/usuarios" element={<AdminRoute><Users /></AdminRoute>} />
        <Route path="/configuracoes" element={<AdminRoute><Settings /></AdminRoute>} />
      </Route>
      <Route path="/recibo/:id" element={<PrivateRoute><Receipt /></PrivateRoute>} />
      <Route path="/termo/:id" element={<PrivateRoute><Term /></PrivateRoute>} />
      <Route path="/fechamento/impressao" element={<PrivateRoute><ClosingPrint /></PrivateRoute>} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="*" element={<Navigate to={HOME} replace />} />
    </Routes>
  );
}
