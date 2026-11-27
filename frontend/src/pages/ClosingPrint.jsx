import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { formatBRL } from "../format.js";
import "../receipt.css";

const FORMATS = {
  80: { label: "Térmica 80mm", page: "@page { margin: 0; }" },
  58: { label: "Térmica 58mm", page: "@page { margin: 0; }" },
  a4: { label: "A4 / PDF", page: "@page { size: A4; margin: 15mm; }" },
};
const dateBR = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");
const dateTimeBR = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// onlyUsed: esconde as formas sem venda (economiza papel no bloco da vendedora)
function Block({ title, totals, onlyUsed = false }) {
  const rows = onlyUsed ? totals.by_payment.filter((p) => p.count > 0) : totals.by_payment;
  return (
    <>
      <div className="r-title">{title}</div>
      {rows.length === 0 && <div className="r-note">Nenhuma venda</div>}
      {rows.map((p) => (
        <div className="r-line" key={p.payment_method_id}>
          <span>{p.name} ({p.count})</span>
          <span>{formatBRL(p.total)}</span>
        </div>
      ))}
      <div className="r-line r-total"><span>TOTAL</span><span>{formatBRL(totals.total)}</span></div>
      <div className="r-line"><span>Vendas / itens</span><span>{totals.count} / {totals.items}</span></div>
      <div className="r-line"><span>Recebido (sem fiado)</span><span>{formatBRL(totals.received)}</span></div>
      {totals.store_credit > 0 && (
        <div className="r-line"><span>Fiado (folha)</span><span>{formatBRL(totals.store_credit)}</span></div>
      )}
    </>
  );
}

// Fechamento de caixa no formato do recibo (térmica) ou A4
export default function ClosingPrint() {
  const [params, setParams] = useSearchParams();
  const embed = params.get("embed") === "1";
  const day = params.get("data");
  const [data, setData] = useState(null);
  const [store, setStore] = useState(null);
  const [error, setError] = useState("");
  const notified = useRef(false);

  useEffect(() => {
    Promise.all([api(`/reports/daily${day ? `?date=${day}` : ""}`), api("/store")])
      .then(([d, st]) => { setData(d); setStore(st); })
      .catch((e) => setError(e.message));
  }, [day]);

  const format = FORMATS[params.get("formato")] ? params.get("formato") : String(store?.paper_width ?? 80);

  useEffect(() => {
    if (data) document.title = `Fechamento ${dateBR(data.date)}`;
    if (embed && data && store && !notified.current) {
      notified.current = true;
      requestAnimationFrame(() => window.parent.postMessage({ type: "print-ready" }, window.location.origin));
    }
  }, [embed, data, store]);

  if (error) return <div className="center"><div className="error">{error}</div></div>;
  if (!data || !store) return <div className="center">Carregando…</div>;

  const cash = data.day.by_payment.find((p) => p.name.trim().toLowerCase() === "dinheiro");
  const setFormat = (f) => setParams((p) => { p.set("formato", f); return p; }, { replace: true });

  return (
    <div className={`receipt-page ${embed ? "embed" : ""}`}>
      <style>{FORMATS[format].page}</style>
      {!embed && (
        <div className="receipt-toolbar no-print">
          <select value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Formato">
            {Object.entries(FORMATS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
          </select>
          <button onClick={() => window.print()}>Imprimir</button>
          <button className="secondary" onClick={() => window.close()}>Fechar</button>
          <p className="muted small-left">Para PDF, escolha <strong>“Salvar como PDF”</strong> no destino da impressão.</p>
        </div>
      )}
      <article className={`receipt fmt-${format}`}>
        <header className="r-head">
          <div className="r-store">{store.name}</div>
          <div className="r-title">FECHAMENTO DE CAIXA</div>
          <div>{dateBR(data.date)}</div>
        </header>
        <hr />
        <Block title="VENDAS DO DIA" totals={data.day} />
        <div className="r-line"><span>Dinheiro em espécie</span><span>{formatBRL(cash?.total ?? 0)}</span></div>
        <hr />
        <Block title={`VENDEDOR(A): ${data.seller.name.toUpperCase()}`} totals={data.seller} onlyUsed />
        <hr />
        <div className="r-note">Emitido em {dateTimeBR(data.generated_at)} por {data.seller.name}</div>
        <div className="r-sign">
          <span className="r-sign-line" />
          <span>Assinatura</span>
        </div>
      </article>
    </div>
  );
}
