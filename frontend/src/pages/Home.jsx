import { useAuth } from "../context/AuthContext.jsx";

export default function Home() {
  const { user, logout } = useAuth();
  return (
    <div className="layout">
      <header className="topbar">
        <strong>Papelaria</strong>
        <div>
          <span className="muted">{user.name}</span>
          <button className="link" onClick={logout}>Sair</button>
        </div>
      </header>
      <main className="content">
        <h2>Olá, {user.name.split(" ")[0]}!</h2>
        <p className="muted">Você está logado como {user.email}.</p>
      </main>
    </div>
  );
}
