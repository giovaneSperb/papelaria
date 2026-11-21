import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(form.name, form.email, form.password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card" onSubmit={onSubmit}>
        <h1>Criar conta</h1>
        <label>
          Nome
          <input value={form.name} onChange={set("name")} required minLength={2} autoFocus />
        </label>
        <label>
          E-mail
          <input type="email" value={form.email} onChange={set("email")} required />
        </label>
        <label>
          Senha
          <input type="password" value={form.password} onChange={set("password")} required minLength={6} />
        </label>
        {error && <div className="error">{error}</div>}
        <button disabled={busy}>{busy ? "Criando…" : "Criar conta"}</button>
        <p className="muted small">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
