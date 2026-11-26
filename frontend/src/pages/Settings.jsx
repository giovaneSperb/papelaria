import { useEffect, useState } from "react";
import { api } from "../api.js";
import StoreForm from "../components/StoreForm.jsx";

function AddForm({ placeholder, onAdd }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onAdd(name);
      setName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack-sm" onSubmit={submit}>
      <div className="row">
        <input className="grow" value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} maxLength={60} required />
        <button disabled={busy || !name.trim()}>Adicionar</button>
      </div>
      {error && <div className="error">{error}</div>}
    </form>
  );
}

export default function Settings() {
  const [methods, setMethods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");

  const loadMethods = () => api("/payment-methods?include_inactive=true").then(setMethods);
  const loadCategories = () => api("/customer-categories").then(setCategories);

  useEffect(() => {
    Promise.all([loadMethods(), loadCategories()]).catch((e) => setError(e.message));
  }, []);

  async function toggleEmployee(c) {
    setError("");
    try {
      await api(`/customer-categories/${c.id}`, { method: "PATCH", body: { is_employee: !c.is_employee } });
      await loadCategories();
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggle(m) {
    setError("");
    try {
      await api(`/payment-methods/${m.id}`, { method: "PATCH", body: { active: !m.active } });
      await loadMethods();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="stack">
      <h2>Configurações</h2>
      {error && <div className="error">{error}</div>}

      <section className="panel">
        <h3>Dados da papelaria</h3>
        <p className="muted small-left">Aparecem no cabeçalho do recibo de venda.</p>
        <StoreForm />
      </section>

      <section className="panel">
        <h3>Formas de pagamento</h3>
        <p className="muted small-left">Formas desativadas não aparecem na venda, mas continuam no histórico.</p>
        <ul className="list">
          {methods.map((m) => (
            <li key={m.id} className={m.active ? "" : "inactive"}>
              <span>{m.name}{m.is_store_credit && <span className="tag tag-gap">só funcionários, com limite</span>}</span>
              <button type="button" className="link small-btn" onClick={() => toggle(m)}>
                {m.active ? "Desativar" : "Ativar"}
              </button>
            </li>
          ))}
        </ul>
        <AddForm
          placeholder="Nova forma (ex.: Vale-presente)"
          onAdd={async (name) => {
            await api("/payment-methods", { method: "POST", body: { name } });
            await loadMethods();
          }}
        />
      </section>

      <section className="panel">
        <h3>Categorias de cliente</h3>
        <ul className="list">
          {categories.map((c) => (
            <li key={c.id}>
              <span>{c.name}</span>
              <label className="check small-left">
                <input type="checkbox" checked={c.is_employee} onChange={() => toggleEmployee(c)} />
                Pode comprar fiado
              </label>
            </li>
          ))}
        </ul>
        <AddForm
          placeholder="Nova categoria (ex.: Professor)"
          onAdd={async (name) => {
            await api("/customer-categories", { method: "POST", body: { name } });
            await loadCategories();
          }}
        />
      </section>
    </div>
  );
}
