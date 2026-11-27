import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

const ROLES = { operador: "Operador(a)", admin: "Administrador(a)" };
const emptyForm = { name: "", email: "", password: "", role: "operador" };

function NewUserForm({ onCreated, onCancel }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await api("/users", { method: "POST", body: form });
      onCreated(user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="stack-sm" onSubmit={submit}>
      <div className="row">
        <label className="grow">
          Nome
          <input value={form.name} onChange={set("name")} required minLength={2} maxLength={120} autoFocus />
        </label>
        <label className="grow">
          E-mail (login)
          <input type="email" value={form.email} onChange={set("email")} required autoComplete="off" />
        </label>
      </div>
      <div className="row">
        <label className="grow">
          Senha inicial
          <input type="password" value={form.password} onChange={set("password")} required minLength={6} maxLength={72} autoComplete="new-password" />
        </label>
        <label className="grow">
          Perfil
          <select value={form.role} onChange={set("role")}>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="row">
        <button disabled={busy}>{busy ? "Salvando…" : "Cadastrar usuário"}</button>
        <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

function PasswordReset({ user, onDone }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      await api(`/users/${user.id}`, { method: "PATCH", body: { password } });
      onDone(`Senha de ${user.name} alterada.`);
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <form className="row pw-row" onSubmit={submit}>
      <input type="password" placeholder="Nova senha (mín. 6)" value={password} onChange={(e) => setPassword(e.target.value)}
        minLength={6} maxLength={72} required autoFocus autoComplete="new-password" />
      <button className="small-btn">Salvar senha</button>
      <button type="button" className="link small-btn" onClick={() => onDone("")}>Cancelar</button>
      {error && <div className="error grow">{error}</div>}
    </form>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => api("/users").then(setUsers).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function update(u, body, msg) {
    setError("");
    setNotice("");
    try {
      await api(`/users/${u.id}`, { method: "PATCH", body });
      // Mudou o próprio perfil: recarrega para o menu refletir as novas permissões
      if (u.id === me.id && body.role) return window.location.reload();
      setNotice(msg);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="stack">
      <div className="panel-head">
        <h2>Usuários</h2>
        {!creating && <button onClick={() => { setNotice(""); setCreating(true); }}>Novo usuário</button>}
      </div>
      <p className="muted small-left">
        <strong>Operador(a)</strong>: vendas, estoque, clientes e caixa. <strong>Administrador(a)</strong>: também cadastra
        usuários e altera as configurações.
      </p>

      {creating && (
        <section className="panel">
          <h3>Novo usuário</h3>
          <NewUserForm
            onCreated={(u) => { setCreating(false); setNotice(`${u.name} cadastrado(a). Passe o e-mail e a senha inicial para a pessoa.`); load(); }}
            onCancel={() => setCreating(false)}
          />
        </section>
      )}

      {notice && <div className="success">{notice}</div>}
      {error && <div className="error">{error}</div>}

      <section className="panel">
        <div className="table-wrap">
          <table className="users-table">
            <thead>
              <tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th></th></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = u.id === me.id;
                return (
                  <tr key={u.id} className={u.is_active ? "" : "inactive-row"}>
                    <td>{u.name}{self && <span className="muted"> (você)</span>}</td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => update(u, { role: e.target.value }, `${u.name} agora é ${ROLES[e.target.value].toLowerCase()}.`)}
                        aria-label={`Perfil de ${u.name}`}
                      >
                        {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td>{u.is_active ? <span className="tag">Ativo</span> : <span className="tag tag-off">Desativado</span>}</td>
                    <td className="actions">
                      {resetting === u.id ? (
                        <PasswordReset user={u} onDone={(msg) => { setResetting(null); if (msg) setNotice(msg); }} />
                      ) : (
                        <>
                          <button type="button" className="link small-btn" onClick={() => { setNotice(""); setResetting(u.id); }}>
                            Trocar senha
                          </button>
                          {!self && (
                            <button
                              type="button"
                              className="link small-btn"
                              onClick={() => update(u, { is_active: !u.is_active }, `${u.name} ${u.is_active ? "desativado(a)" : "reativado(a)"}.`)}
                            >
                              {u.is_active ? "Desativar" : "Reativar"}
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
