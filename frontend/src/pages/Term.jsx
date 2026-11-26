import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { formatCpf } from "../cpf.js";
import { formatBRL } from "../format.js";
import "../term.css";

const FORMATS = {
  a4: { label: "A4 / PDF", page: "@page { size: A4; margin: 18mm 20mm; }" },
  80: { label: "Térmica 80mm", page: "@page { margin: 0; }" },
};

const longDate = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
const shortDateTime = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Termo de autorização para desconto em folha (compra no fiado)
export default function Term() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const embed = params.get("embed") === "1";
  const format = FORMATS[params.get("formato")] ? params.get("formato") : "a4";

  const [sale, setSale] = useState(null);
  const [store, setStore] = useState(null);
  const [error, setError] = useState("");
  const notified = useRef(false);

  useEffect(() => {
    Promise.all([api(`/sales/${id}`), api("/store")])
      .then(([s, st]) => {
        if (!s.customer) throw new Error("Esta venda não tem cliente — o termo precisa do funcionário.");
        setSale(s);
        setStore(st);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (sale) document.title = `Termo — venda nº ${sale.id}`;
    if (embed && sale && store && !notified.current) {
      notified.current = true;
      requestAnimationFrame(() => window.parent.postMessage({ type: "print-ready", id: Number(id) }, window.location.origin));
    }
  }, [embed, sale, store, id]);

  if (error) return <div className="center"><div className="error">{error}</div></div>;
  if (!sale || !store) return <div className="center">Carregando termo…</div>;

  const c = sale.customer;
  const setFormat = (f) => setParams((p) => { p.set("formato", f); return p; }, { replace: true });

  return (
    <div className={`term-page ${embed ? "embed" : ""}`}>
      <style>{FORMATS[format].page}</style>

      {!embed && (
        <div className="receipt-toolbar no-print">
          <select value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Formato">
            {Object.entries(FORMATS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
          </select>
          <button onClick={() => window.print()}>Imprimir</button>
          <button className="secondary" onClick={() => window.close()}>Fechar</button>
          <p className="muted small-left">
            Escolha a impressora comum (A4) na janela de impressão, ou <strong>“Salvar como PDF”</strong>.
          </p>
        </div>
      )}

      <article className={`term fmt-${format}`}>
        <h1>TERMO DE AUTORIZAÇÃO PARA DESCONTO EM FOLHA DE PAGAMENTO</h1>

        <p>
          Eu, <span className="fill">{c.name}</span>, portador(a) do CPF nº{" "}
          <span className="fill">{formatCpf(c.cpf)}</span>,{" "}
          <em>
            funcionário(a) do {store.institution || <span className="blank wide" />}, autorizo, de forma expressa e
            irrevogável, o desconto em minha
          </em>{" "}
          folha de pagamento dos valores referentes às compras realizadas na <strong>papelaria do Colégio</strong>.
        </p>
        <p>
          Declaro estar ciente de que os valores descontados corresponderão ao total das compras efetuadas,
          conforme controles internos da empresa, podendo o desconto ocorrer em uma ou no máximo em 3
          parcelas, de acordo com as normas internas vigentes.
        </p>
        <p>
          Declaro ainda que, ao optar pela compra com desconto em folha,{" "}
          <strong>perderei automaticamente o direito ao desconto concedido a funcionários</strong>, sendo os
          valores cobrados pelo preço integral praticado pela papelaria.
        </p>
        <p>
          Esta autorização é concedida de forma voluntária, estando de acordo com a legislação trabalhista aplicável,{" "}
          <em>e permanecerá válida enquanto houver valores pendentes de desconto.</em>
        </p>

        <section className="term-sale">
          <div className="term-sale-head">
            <strong>Compra referente a este termo — venda nº {String(sale.id).padStart(6, "0")}</strong>
            <span>{shortDateTime(sale.created_at)}</span>
          </div>
          <table>
            <thead>
              <tr><th>Produto</th><th className="r">Qtd.</th><th className="r">Unit.</th><th className="r">Total</th></tr>
            </thead>
            <tbody>
              {sale.items.map((i, n) => (
                <tr key={n}>
                  <td>{i.product_name}</td>
                  <td className="r">{i.quantity}</td>
                  <td className="r">{formatBRL(i.unit_price)}</td>
                  <td className="r">{formatBRL(i.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={3}>Total a descontar em folha</td><td className="r">{formatBRL(sale.total)}</td></tr>
            </tfoot>
          </table>
        </section>

        <p>Por estar de pleno acordo, firmo o presente termo.</p>

        <div className="term-field">
          Local e data:{" "}
          <span className="fill">
            {store.city ? `${store.city}, ` : <span className="blank" />}
            {longDate(sale.created_at)}
          </span>
        </div>

        <div className="term-sign">
          <span>Assinatura do(a) funcionário(a):</span>
          <span className="line" />
        </div>
        <div className="term-field">
          Nome completo: <span className="fill">{c.name}</span>
        </div>
        <div className="term-sign">
          <span>Assinatura do(a) vendedor(a):</span>
          <span className="line" />
          <span className="under">{sale.seller}</span>
        </div>
      </article>
    </div>
  );
}
