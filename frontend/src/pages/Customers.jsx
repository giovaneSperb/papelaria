import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import CustomerForm from "../components/CustomerForm.jsx";
import { formatCpf } from "../cpf.js";
import { formatBRL } from "../format.js";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  // editing: null | { mode: "new" } | { mode: "edit", customer }
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (q = "") => {
    try {
      setCustomers(await api(`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    api("/customer-categories").then(setCategories).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 250);
    return () => clearTimeout(t);
  }, [search, load]);

  async function save(data) {
    if (editing.mode === "new") {
      await api("/customers", { method: "POST", body: data });
      setNotice(`"${data.name}" cadastrado.`);
    } else {
      await api(`/customers/${editing.customer.id}`, { method: "PUT", body: data });
      setNotice(`"${data.name}" atualizado.`);
    }
    setEditing(null);
    load(search);
  }

  return (
    <div className="stack">
      <div className="panel-head">
        <h2>Clientes</h2>
        {!editing && (
          <button onClick={() => { setNotice(""); setEditing({ mode: "new" }); }}>Novo cliente</button>
        )}
      </div>

      {editing && categories.length > 0 && (
        <section className="panel">
          <h3>{editing.mode === "new" ? "Novo cliente" : "Editar cliente"}</h3>
          <CustomerForm
            key={editing.customer?.id ?? "new"}
            initial={editing.customer && {
              name: editing.customer.name,
              cpf: editing.customer.cpf,
              category_id: editing.customer.category.id,
              credit_limit: editing.customer.credit_limit,
            }}
            categories={categories}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </section>
      )}

      {notice && <div className="success">{notice}</div>}
      {error && <div className="error">{error}</div>}

      <section className="panel">
        <div className="panel-head">
          <h3>Cadastrados</h3>
          <input className="search" placeholder="Buscar por nome ou CPF" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {customers.length === 0 ? (
          <p className="muted">Nenhum cliente encontrado.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nome</th><th>CPF</th><th>Categoria</th><th className="num">Fiado no mês</th></tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} onClick={() => { setNotice(""); setEditing({ mode: "edit", customer: c }); }} title="Clique para editar">
                    <td>{c.name}</td>
                    <td><code>{formatCpf(c.cpf)}</code></td>
                    <td><span className="tag">{c.category.name}</span></td>
                    <td className="num">
                      {c.credit_limit == null ? "" : c.credit_limit > 0 ? (
                        <span title={`Disponível: ${formatBRL(c.credit_available)}`}>
                          {formatBRL(c.credit_used)} <span className="muted">de {formatBRL(c.credit_limit)}</span>
                        </span>
                      ) : <span className="muted">sem limite</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
