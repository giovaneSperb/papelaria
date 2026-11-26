import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import CameraScanner from "../components/CameraScanner.jsx";
import CustomerForm from "../components/CustomerForm.jsx";
import PhotoScanButton from "../components/PhotoScanButton.jsx";
import ProductAutocomplete from "../components/ProductAutocomplete.jsx";
import ProductImage from "../components/ProductImage.jsx";
import { formatCpf, isValidCpf, onlyDigits } from "../cpf.js";
import { formatBRL, parsePrice } from "../format.js";
import { getAutoPrint, openReceipt, openTerm, printReceipt, printTerm, setAutoPrint } from "../print.js";

const isCash = (method) => method?.name.trim().toLowerCase() === "dinheiro";
const time = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function Sale() {
  const scanRef = useRef(null);

  // ---------- produtos / carrinho
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState(false);
  const [finding, setFinding] = useState(false);
  const [choices, setChoices] = useState([]); // vários produtos achados pelo nome
  const [cart, setCart] = useState([]); // [{ product, quantity }]

  // ---------- cliente
  const [categories, setCategories] = useState([]);
  const [cpf, setCpf] = useState("");
  // customerState: idle | loading | found | notfound | invalid
  const [customerState, setCustomerState] = useState("idle");
  const [customer, setCustomer] = useState(null);

  // ---------- pagamento
  const [methods, setMethods] = useState([]);
  const [methodId, setMethodId] = useState(null);
  const [received, setReceived] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recent, setRecent] = useState([]);
  const [lastSale, setLastSale] = useState(null);
  const [autoPrint, setAutoPrintState] = useState(getAutoPrint);
  const [printing, setPrinting] = useState(false);

  async function runPrint(job) {
    setPrinting(true);
    try {
      await job();
    } finally {
      setPrinting(false);
      scanRef.current?.focus();
    }
  }
  const doPrint = (saleId) => runPrint(() => printReceipt(saleId));
  const doPrintTerm = (saleId) => runPrint(() => printTerm(saleId));

  const loadRecent = useCallback(() => api("/sales?limit=10").then(setRecent).catch(() => {}), []);

  useEffect(() => {
    Promise.all([
      api("/payment-methods").then(setMethods),
      api("/customer-categories").then(setCategories),
    ]).catch((e) => setError(e.message));
    loadRecent();
    scanRef.current?.focus();
  }, [loadRecent]);

  const total = useMemo(() => cart.reduce((s, i) => s + i.product.price * i.quantity, 0), [cart]);
  const method = methods.find((m) => m.id === methodId);
  const receivedValue = received.trim() ? parsePrice(received) : NaN;
  const change = isCash(method) && !Number.isNaN(receivedValue) ? receivedValue - total : null;

  // ---------- fiado: só funcionário com limite, dentro do disponível do mês
  const isFiado = !!method?.is_store_credit;
  const isEmployee = !!customer?.category.is_employee;
  const canUseFiado = isEmployee && (customer?.credit_limit ?? 0) > 0;
  const fiadoAfter = isFiado && canUseFiado ? Math.round((customer.credit_available - total) * 100) / 100 : null;
  const fiadoHint = !customer
    ? "Fiado: informe o CPF de um funcionário."
    : !isEmployee
    ? `Fiado só para funcionários (${customer.name} é ${customer.category.name}).`
    : !canUseFiado
    ? "Funcionário sem limite de fiado — defina o limite em Clientes."
    : null;

  // ---------- carrinho
  function addToCart(product) {
    setChoices([]);
    setLastSale(null);
    setCart((c) => {
      const found = c.find((i) => i.product.id === product.id);
      if (found) return c.map((i) => (i === found ? { ...i, quantity: i.quantity + 1 } : i));
      return [...c, { product, quantity: 1 }];
    });
    setNotice("");
    setError("");
    scanRef.current?.focus();
  }

  function setQty(productId, quantity) {
    setCart((c) =>
      c.map((i) => (i.product.id === productId ? { ...i, quantity: Math.max(1, quantity || 1) } : i))
    );
  }

  const removeItem = (productId) => setCart((c) => c.filter((i) => i.product.id !== productId));

  // Procura pelo código de barras; se não achar, procura pelo nome
  const findProduct = useCallback(async (term) => {
    term = term.trim();
    if (!term) return;
    setCamera(false);
    setFinding(true);
    setError("");
    setChoices([]);
    try {
      try {
        addToCart(await api(`/products/barcode/${encodeURIComponent(term)}`));
        return;
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      const list = await api(`/products?q=${encodeURIComponent(term)}&limit=20`);
      if (list.length === 1) addToCart(list[0]);
      else if (list.length > 1) setChoices(list);
      else setError(`Nenhum produto encontrado para "${term}". Cadastre-o no Estoque.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setFinding(false);
      setCode("");
    }
  }, []);

  // ---------- cliente pelo CPF
  async function onCpfChange(value) {
    const formatted = formatCpf(value);
    setCpf(formatted);
    setCustomer(null);
    const digits = onlyDigits(formatted);
    if (digits.length < 11) return setCustomerState("idle");
    if (!isValidCpf(digits)) return setCustomerState("invalid");
    setCustomerState("loading");
    try {
      setCustomer(await api(`/customers/cpf/${digits}`));
      setCustomerState("found");
    } catch (e) {
      if (e.status === 404) setCustomerState("notfound");
      else {
        setCustomerState("idle");
        setError(e.message);
      }
    }
  }

  async function registerCustomer(data) {
    const created = await api("/customers", { method: "POST", body: data });
    setCustomer(created);
    setCustomerState("found");
  }

  function clearCustomer() {
    // Sem cliente não há fiado: desmarca a forma de pagamento se for fiado
    setMethodId((id) => (methods.find((m) => m.id === id)?.is_store_credit ? null : id));
    setCpf("");
    setCustomer(null);
    setCustomerState("idle");
  }

  // ---------- finalizar
  const cpfPending = onlyDigits(cpf).length > 0 && customerState !== "found";
  const missingStock = cart.filter((i) => i.quantity > i.product.quantity);
  const fiadoOk = !isFiado || (canUseFiado && fiadoAfter >= 0);
  const canFinish = cart.length > 0 && method && !cpfPending && !saving && (change === null || change >= 0) && fiadoOk;

  async function finish() {
    setError("");
    if (!cart.length) return setError("Adicione pelo menos um produto.");
    if (!method) return setError("Escolha a forma de pagamento.");
    if (cpfPending) return setError("Termine o cadastro do cliente ou apague o CPF.");
    if (change !== null && change < 0) return setError("Valor recebido é menor que o total.");
    if (isFiado && !canUseFiado) return setError(fiadoHint);
    if (isFiado && fiadoAfter < 0) return setError("A compra passa do limite de fiado disponível.");
    setSaving(true);
    try {
      const sale = await api("/sales", {
        method: "POST",
        body: {
          customer_id: customer?.id ?? null,
          payment_method_id: method.id,
          items: cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
          amount_received: change !== null ? receivedValue : null,
        },
      });
      let msg = `Venda nº ${sale.id} finalizada: ${formatBRL(sale.total)} no ${sale.payment_method}`;
      if (sale.customer) msg += ` para ${sale.customer.name}`;
      if (change !== null) msg += `. Troco: ${formatBRL(change)}`;
      setNotice(msg + ".");
      setLastSale(sale);
      // Fiado: o termo para o funcionário assinar sai sempre; o recibo, se marcado
      if (autoPrint || sale.is_store_credit) {
        runPrint(async () => {
          if (autoPrint) await printReceipt(sale.id);
          if (sale.is_store_credit) await printTerm(sale.id);
        });
      }
      setCart([]);
      clearCustomer();
      setMethodId(null);
      setReceived("");
      loadRecent();
      scanRef.current?.focus();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <div className="panel-head">
        <h2>Venda</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={autoPrint}
            onChange={(e) => { setAutoPrintState(e.target.checked); setAutoPrint(e.target.checked); }}
          />
          Imprimir recibo ao finalizar
        </label>
      </div>
      {notice && (
        <div className="success sale-done">
          <span>{notice}</span>
          {lastSale && (
            <span className="row">
              <button type="button" className="small-btn" disabled={printing} onClick={() => doPrint(lastSale.id)}>
                {printing ? "Imprimindo…" : "Imprimir recibo"}
              </button>
              <button type="button" className="secondary small-btn" onClick={() => openReceipt(lastSale.id, "a4")}>
                Ver / Salvar PDF
              </button>
              {lastSale.is_store_credit && (
                <>
                  <button type="button" className="small-btn" disabled={printing} onClick={() => doPrintTerm(lastSale.id)}>
                    Imprimir termo
                  </button>
                  <button type="button" className="secondary small-btn" onClick={() => openTerm(lastSale.id)}>
                    Ver termo
                  </button>
                </>
              )}
            </span>
          )}
        </div>
      )}

      <div className="sale-grid">
        {/* ---------- coluna dos produtos */}
        <div className="stack">
          <section className="panel">
            <form className="scan-row" onSubmit={(e) => { e.preventDefault(); findProduct(code); }}>
              <div className="grow field">
                <label htmlFor="sale-product">Produto</label>
                <ProductAutocomplete
                  id="sale-product"
                  inputRef={scanRef}
                  value={code}
                  onChange={setCode}
                  onPick={(p) => { addToCart(p); setCode(""); }}
                  paused={finding}
                  placeholder="Escaneie o código ou digite o nome"
                />
              </div>
              <button disabled={finding || !code.trim()}>{finding ? "Buscando…" : "Adicionar"}</button>
              <button type="button" className="secondary" onClick={() => setCamera((c) => !c)}>
                {camera ? "Fechar câmera" : "Usar câmera"}
              </button>
              <PhotoScanButton onDetected={findProduct} onError={setError} />
            </form>
            {camera && <CameraScanner onDetected={findProduct} onClose={() => setCamera(false)} />}
            {choices.length > 0 && (
              <div className="choices">
                <p className="muted small-left">Vários produtos encontrados — escolha um:</p>
                {choices.map((p) => (
                  <button type="button" key={p.id} className="choice" onClick={() => addToCart(p)}>
                    <ProductImage src={p.image} size={36} />
                    <span className="grow">{p.name}</span>
                    <span className="muted">{formatBRL(p.price)}</span>
                  </button>
                ))}
              </div>
            )}
            {error && <div className="error">{error}</div>}
          </section>

          <section className="panel">
            <h3>Itens</h3>
            {cart.length === 0 ? (
              <p className="muted">Nenhum produto adicionado.</p>
            ) : (
              <div className="table-wrap">
                <table className="cart">
                  <thead>
                    <tr>
                      <th className="hide-sm"></th>
                      <th>Produto</th>
                      <th className="num">Qtd.</th>
                      <th className="num hide-sm">Unit.</th>
                      <th className="num">Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(({ product: p, quantity }) => (
                      <tr key={p.id} className={quantity > p.quantity ? "warn" : ""}>
                        <td className="thumb-cell hide-sm"><ProductImage src={p.image} size={36} /></td>
                        <td>
                          {p.name}
                          <div className="muted small-left only-sm">{formatBRL(p.price)} un.</div>
                          {quantity > p.quantity && (
                            <div className="warn-text">Só tem {p.quantity} em estoque</div>
                          )}
                        </td>
                        <td className="num">
                          <div className="qty">
                            <button type="button" className="secondary" onClick={() => setQty(p.id, quantity - 1)} aria-label="Diminuir">−</button>
                            <input
                              type="number"
                              min="1"
                              value={quantity}
                              onChange={(e) => setQty(p.id, parseInt(e.target.value, 10))}
                              aria-label="Quantidade"
                            />
                            <button type="button" className="secondary" onClick={() => setQty(p.id, quantity + 1)} aria-label="Aumentar">+</button>
                          </div>
                        </td>
                        <td className="num hide-sm">{formatBRL(p.price)}</td>
                        <td className="num">{formatBRL(p.price * quantity)}</td>
                        <td>
                          <button type="button" className="link" onClick={() => removeItem(p.id)} aria-label="Remover">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* ---------- coluna cliente / pagamento */}
        <div className="stack">
          <section className="panel">
            <h3>Cliente <span className="muted small-left">(opcional)</span></h3>
            {customerState === "found" && customer ? (
              <div className="customer-card">
                <div>
                  <strong>{customer.name}</strong>
                  <div className="muted small-left">
                    {formatCpf(customer.cpf)} · <span className="tag">{customer.category.name}</span>
                  </div>
                  {isEmployee && (
                    <div className="small-left credit-line">
                      {canUseFiado ? (
                        <>Fiado no mês: <strong>{formatBRL(customer.credit_available)}</strong> disponível de {formatBRL(customer.credit_limit)}</>
                      ) : (
                        <span className="muted">Sem limite de fiado definido</span>
                      )}
                    </div>
                  )}
                </div>
                <button type="button" className="link small-btn" onClick={clearCustomer}>Trocar</button>
              </div>
            ) : (
              <>
                <label>
                  CPF
                  <input
                    value={cpf}
                    onChange={(e) => onCpfChange(e.target.value)}
                    inputMode="numeric"
                    placeholder="Deixe vazio para venda sem cliente"
                  />
                </label>
                {customerState === "loading" && <p className="muted small-left">Buscando cliente…</p>}
                {customerState === "invalid" && <div className="error">CPF inválido.</div>}
                {customerState === "notfound" && categories.length > 0 && (
                  <>
                    <p className="muted small-left">Cliente não cadastrado. Preencha para cadastrar:</p>
                    <CustomerForm
                      key={cpf}
                      initial={{ cpf }}
                      categories={categories}
                      cpfLocked
                      submitLabel="Cadastrar cliente"
                      onSubmit={registerCustomer}
                      onCancel={clearCustomer}
                    />
                  </>
                )}
              </>
            )}
          </section>

          <section className="panel">
            <h3>Pagamento</h3>
            <div className="pay-options">
              {methods.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  className={`pay ${m.id === methodId ? "selected" : ""}`}
                  onClick={() => setMethodId(m.id)}
                  aria-pressed={m.id === methodId}
                  disabled={m.is_store_credit && !canUseFiado}
                  title={m.is_store_credit && !canUseFiado ? fiadoHint : undefined}
                >
                  {m.name}
                </button>
              ))}
            </div>
            {fiadoHint && methods.some((m) => m.is_store_credit) && (
              <p className="muted small-left">{fiadoHint}</p>
            )}
            {isCash(method) && (
              <label>
                Valor recebido (R$)
                <input inputMode="decimal" placeholder="0,00" value={received} onChange={(e) => setReceived(e.target.value)} />
              </label>
            )}
            <div className="totals">
              <div><span>Total</span><strong className="total">{formatBRL(total)}</strong></div>
              {change !== null && (
                <div className={change < 0 ? "neg" : ""}>
                  <span>{change < 0 ? "Falta" : "Troco"}</span>
                  <strong>{formatBRL(Math.abs(change))}</strong>
                </div>
              )}
              {fiadoAfter !== null && (
                <div className={fiadoAfter < 0 ? "neg" : ""}>
                  <span>{fiadoAfter < 0 ? "Passa do limite em" : "Fiado disponível após"}</span>
                  <strong>{formatBRL(Math.abs(fiadoAfter))}</strong>
                </div>
              )}
            </div>
            {missingStock.length > 0 && (
              <div className="error">Há itens com quantidade maior que o estoque.</div>
            )}
            <button type="button" className="finish" disabled={!canFinish} onClick={finish}>
              {saving ? "Finalizando…" : "Finalizar venda"}
            </button>
            {cart.length > 0 && (
              <button type="button" className="link small-btn" onClick={() => { setCart([]); setError(""); }}>
                Cancelar venda
              </button>
            )}
          </section>
        </div>
      </div>

      <section className="panel">
        <h3>Últimas vendas</h3>
        {recent.length === 0 ? (
          <p className="muted">Nenhuma venda ainda.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nº</th><th>Hora</th><th>Cliente</th><th>Pagamento</th><th className="num">Itens</th><th className="num">Total</th><th></th></tr>
              </thead>
              <tbody className="no-click">
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{time(s.created_at)}</td>
                    <td>{s.customer ? s.customer.name : <span className="muted">—</span>}</td>
                    <td>{s.payment_method}</td>
                    <td className="num">{s.items.reduce((n, i) => n + i.quantity, 0)}</td>
                    <td className="num">{formatBRL(s.total)}</td>
                    <td className="num">
                      <button type="button" className="link small-btn" onClick={() => openReceipt(s.id)}>Recibo</button>
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
