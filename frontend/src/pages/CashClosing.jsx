import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { formatBRL } from "../format.js";
import { openClosing, printClosing } from "../print.js";

// Data de hoje no horário de Brasília (AAAA-MM-DD)
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const longDate = (iso) => {
  const s = new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function PaymentTable({ totals }) {
  return (
    <div className="table-wrap">
      <table className="closing-table">
        <thead>
          <tr><th>Forma de pagamento</th><th className="num">Vendas</th><th className="num">Total</th></tr>
        </thead>
        <tbody>
          {totals.by_payment.map((p) => (
            <tr key={p.payment_method_id} className={p.count === 0 ? "dim" : ""}>
              <td>
                {p.name}
                {p.is_store_credit && <span className="tag tag-gap">desconto em folha</span>}
              </td>
              <td className="num">{p.count}</td>
              <td className="num">{formatBRL(p.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td>Total</td><td className="num">{totals.count}</td><td className="num">{formatBRL(totals.total)}</td></tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function CashClosing() {
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async (d) => {
    setLoading(true);
    setError("");
    try {
      setData(await api(`/reports/daily?date=${d}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (date) load(date);
  }, [date, load]);

  const cash = data?.day.by_payment.find((p) => p.name.trim().toLowerCase() === "dinheiro");
  const isToday = date === today();

  async function print() {
    setPrinting(true);
    try {
      await printClosing(date);
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="stack">
      <div className="panel-head">
        <h2>Fechamento de caixa</h2>
        <div className="row">
          <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} aria-label="Data" />
          <button type="button" className="secondary" onClick={() => load(date)} disabled={loading}>Atualizar</button>
          <button type="button" onClick={print} disabled={!data || printing}>{printing ? "Imprimindo…" : "Imprimir"}</button>
          <button type="button" className="secondary" onClick={() => openClosing(date, "a4")} disabled={!data}>Ver / PDF</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      {data && (
        <>
          <p className="muted closing-date">
            {longDate(data.date)}{isToday && " (hoje — parcial até agora)"}
          </p>

          <div className="kpis">
            <div className="kpi">
              <span>Total vendido</span>
              <strong>{formatBRL(data.day.total)}</strong>
              <small>{data.day.count} venda(s) · {data.day.items} item(ns)</small>
            </div>
            <div className="kpi">
              <span>Recebido no caixa</span>
              <strong>{formatBRL(data.day.received)}</strong>
              <small>sem o fiado</small>
            </div>
            <div className="kpi">
              <span>Dinheiro em espécie</span>
              <strong>{formatBRL(cash?.total ?? 0)}</strong>
              <small>deve estar na gaveta</small>
            </div>
            <div className="kpi">
              <span>Fiado</span>
              <strong>{formatBRL(data.day.store_credit)}</strong>
              <small>a descontar em folha</small>
            </div>
          </div>

          <section className="panel">
            <h3>Vendas do dia por forma de pagamento</h3>
            <PaymentTable totals={data.day} />
          </section>

          <section className="panel seller-panel">
            <div className="panel-head">
              <h3>Minhas vendas — {data.seller.name}</h3>
              <strong className="seller-total">{formatBRL(data.seller.total)}</strong>
            </div>
            <p className="muted small-left">
              {data.seller.count} venda(s) · recebido {formatBRL(data.seller.received)}
              {data.seller.store_credit > 0 && ` · fiado ${formatBRL(data.seller.store_credit)}`}
            </p>
            <PaymentTable totals={data.seller} />
          </section>
        </>
      )}
    </div>
  );
}
