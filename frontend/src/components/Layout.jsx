import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Layout() {
  const { user, logout } = useAuth();
  const [store, setStore] = useState(null);

  useEffect(() => {
    api("/store").then(setStore).catch(() => {});
    // Configurações avisa quando o logotipo ou o nome mudam
    const onUpdate = (e) => setStore(e.detail);
    window.addEventListener("store-updated", onUpdate);
    return () => window.removeEventListener("store-updated", onUpdate);
  }, []);

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar-left">
          <Link to="/venda" className="brand" title={store?.name ?? "Papelaria"}>
            {store?.logo ? <img src={store.logo} alt={store.name} /> : <strong>{store?.name ?? "Papelaria"}</strong>}
          </Link>
          <nav>
            <NavLink to="/venda">Venda</NavLink>
            <NavLink to="/estoque">Estoque</NavLink>
            <NavLink to="/clientes">Clientes</NavLink>
            <NavLink to="/configuracoes">Configurações</NavLink>
          </nav>
        </div>
        <div>
          <span className="muted hide-sm">{user.name}</span>
          <button className="link" onClick={logout}>Sair</button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
