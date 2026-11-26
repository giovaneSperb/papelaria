import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { formatCpf } from "../cpf.js";
import { formatBRL } from "../format.js";
import { toThermalLogo } from "../image.js";
import "../receipt.css";

const FORMATS = {
  80: { label: "Térmica 80mm", page: "@page { margin: 0; }" },
  58: { label: "Térmica 58mm", page: "@page { margin: 0; }" },
  a4: { label: "A4 / PDF", page: "@page { size: A4; margin: 15mm; }" },
};

const dateTime = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function Receipt() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const embed = params.get("embed") === "1";

  const [sale, setSale] = useState(null);
  const [store, setStore] = useState(null);
  const [logoSrc, setLogoSrc] = useState(null);
  const [logoDone, setLogoDone] = useState(false);
  const [error, setError] = useState("");
  const notified = useRef(false);

  useEffect(() => {
    Promise.all([api(`/sales/${id}`), api("/store")])
      .then(([s, st]) => {
        setSale(s);
        setStore(st);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const format = FORMATS[params.get("formato")] ? params.get("formato") : String(store?.paper_width ?? 80);
  const thermal = format !== "a4";
  const ready = sale && store && logoDone;

  // Logotipo: colorido no A4; em tons de cinza nas térmicas
  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    setLogoDone(false);
    if (!store.logo) {
      setLogoSrc(null);
      setLogoDone(true);
      return;
    }
    if (!thermal) {
      setLogoSrc(store.logo);
      return;
    }
    toThermalLogo(store.logo)
      .then((src) => !cancelled && setLogoSrc(src))
      .catch(() => !cancelled && setLogoSrc(store.logo));
    return () => {
      cancelled = true;
    };
  }, [store, thermal]);

  // Dentro do iframe de impressão: avisa a página de venda que pode imprimir
  useEffect(() => {
    if (embed && ready && !notified.current) {
      notified.current = true;
      requestAnimationFrame(() => window.parent.postMessage({ type: "print-ready", id: Number(id) }, window.location.origin));
    }
  }, [embed, ready, id]);

  useEffect(() => {
    if (sale) document.title = `Recibo nº ${sale.id}`;
  }, [sale]);

  if (error) return <div className="center"><div className="error">{error}</div></div>;
  if (!sale || !store) return <div className="center">Carregando recibo…</div>;

  const setFormat = (f) => setParams((p) => { p.set("formato", f); return p; }, { replace: true });
  const itemsCount = sale.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className={`receipt-page ${embed ? "embed" : ""}`}>
      <style>{FORMATS[format].page}</style>

      {!embed && (
        <div className="receipt-toolbar no-print">
          <select value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Formato">
            {Object.entries(FORMATS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
          </select>
          <button onClick={() => window.print()}>Imprimir</button>
          <button className="secondary" onClick={() => { setFormat("a4"); setTimeout(() => window.print(), 50); }}>
            Salvar PDF
          </button>
          <button className="secondary" onClick={() => window.close()}>Fechar</button>
          <p className="muted small-left">Para PDF, escolha <strong>“Salvar como PDF”</strong> no destino da impressão.</p>
        </div>
      )}

      <article className={`receipt fmt-${format}`}>
        <header className="r-head">
          {logoSrc && (
            <img className="r-logo" src={logoSrc} alt="" onLoad={() => setLogoDone(true)} onError={() => setLogoDone(true)} />
          )}
          <div className="r-store">{store.name}</div>
          {store.cnpj && <div>CNPJ: {store.cnpj}</div>}
          {store.address && <div>{store.address}</div>}
          {store.phone && <div>Tel.: {store.phone}</div>}
        </header>

        <hr />
        <div className="r-title">RECIBO DE VENDA Nº {String(sale.id).padStart(6, "0")}</div>
        <div className="r-line"><span>Data</span><span>{dateTime(sale.created_at)}</span></div>
        <div className="r-line"><span>Atendente</span><span>{sale.seller}</span></div>
        {sale.customer && (
          <>
            <div className="r-line"><span>Cliente</span><span>{sale.customer.name}</span></div>
            <div className="r-line"><span>CPF</span><span>{formatCpf(sale.customer.cpf)}</span></div>
          </>
        )}

        <hr />
        <table className="r-items">
          <thead>
            <tr><th>Item</th><th className="r-num">Total</th></tr>
          </thead>
          <tbody>
            {sale.items.map((i, n) => (
              <tr key={n}>
                <td>
                  <div className="r-name">{i.product_name}</div>
                  <div className="r-qty">{i.quantity} x {formatBRL(i.unit_price)}</div>
                </td>
                <td className="r-num">{formatBRL(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <hr />
        <div className="r-line"><span>Itens</span><span>{itemsCount}</span></div>
        <div className="r-line r-total"><span>TOTAL</span><span>{formatBRL(sale.total)}</span></div>
        <div className="r-line"><span>Pagamento</span><span>{sale.payment_method}</span></div>
        {sale.amount_received != null && (
          <>
            <div className="r-line"><span>Valor recebido</span><span>{formatBRL(sale.amount_received)}</span></div>
            <div className="r-line"><span>Troco</span><span>{formatBRL(sale.change)}</span></div>
          </>
        )}

        <hr />
        {store.footer && <div className="r-footer">{store.footer}</div>}
        <div className="r-note">Documento sem valor fiscal</div>
      </article>
    </div>
  );
}
