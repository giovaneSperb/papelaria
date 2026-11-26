import { useEffect, useRef, useState } from "react";
import { formatCpf, isValidCpf, onlyDigits } from "../cpf.js";
import { parsePrice, priceToInput } from "../format.js";

/*
  Formulário de cliente (nome, CPF, categoria).
  initial: { name, cpf, category_id, credit_limit }   cpfLocked: CPF só leitura (veio da venda)
  onSubmit(data) deve lançar erro com .message em caso de falha.
*/
export default function CustomerForm({ initial, categories, onSubmit, onCancel, submitLabel = "Salvar", cpfLocked = false }) {
  const nameRef = useRef(null);
  const defaultCategory = categories.find((c) => c.name === "Cliente")?.id ?? categories[0]?.id ?? "";
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    cpf: formatCpf(initial?.cpf ?? ""),
    category_id: initial?.category_id ?? defaultCategory,
    credit_limit: initial?.credit_limit ? priceToInput(initial.credit_limit) : "",
  });
  const isEmployee = categories.find((c) => c.id === Number(form.category_id))?.is_employee ?? false;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => nameRef.current?.focus(), []);
  useEffect(() => {
    if (!form.category_id && defaultCategory) setForm((f) => ({ ...f, category_id: defaultCategory }));
  }, [defaultCategory, form.category_id]);

  async function submit(e) {
    e.preventDefault();
    e.stopPropagation(); // não dispara o formulário de fora (página de venda)
    setError("");
    if (!isValidCpf(form.cpf)) return setError("CPF inválido");
    if (!form.category_id) return setError("Escolha a categoria");
    let credit_limit = null;
    if (isEmployee && form.credit_limit.trim()) {
      credit_limit = parsePrice(form.credit_limit);
      if (Number.isNaN(credit_limit) || credit_limit < 0) return setError("Limite de fiado inválido");
    }
    setBusy(true);
    try {
      await onSubmit({ name: form.name, cpf: onlyDigits(form.cpf), category_id: Number(form.category_id), credit_limit });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="stack-sm" onSubmit={submit}>
      <label>
        Nome
        <input ref={nameRef} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={200} />
      </label>
      <div className="row">
        {!cpfLocked && (
          <label className="grow">
            CPF
            <input
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: formatCpf(e.target.value) })}
              inputMode="numeric"
              placeholder="000.000.000-00"
              required
            />
          </label>
        )}
        <label className="grow">
          Categoria
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>
      {isEmployee && (
        <label>
          Limite mensal de fiado (R$)
          <input
            inputMode="decimal"
            placeholder="0,00 — sem limite definido não compra fiado"
            value={form.credit_limit}
            onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
          />
        </label>
      )}
      {error && <div className="error">{error}</div>}
      <div className="row">
        <button disabled={busy}>{busy ? "Salvando…" : submitLabel}</button>
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>}
      </div>
    </form>
  );
}
