import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { resizeImage } from "../image.js";

const empty = { name: "", cnpj: "", address: "", phone: "", footer: "", paper_width: 80, institution: "", city: "" };

// Dados da papelaria que saem no cabeçalho do recibo
export default function StoreForm() {
  const fileRef = useRef(null);
  const [form, setForm] = useState(empty);
  const [logo, setLogo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const apply = (st) => {
    window.dispatchEvent(new CustomEvent("store-updated", { detail: st })); // atualiza o logotipo do topo
    setForm({
      name: st.name, cnpj: st.cnpj ?? "", address: st.address ?? "", phone: st.phone ?? "",
      footer: st.footer ?? "", paper_width: st.paper_width,
      institution: st.institution ?? "", city: st.city ?? "",
    });
    setLogo(st.logo);
  };

  useEffect(() => {
    api("/store").then(apply).catch((e) => setError(e.message));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      apply(await api("/store", { method: "PUT", body: { ...form, paper_width: Number(form.paper_width) } }));
      setNotice("Dados salvos.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onLogo(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setNotice("");
    try {
      const fd = new FormData();
      fd.append("file", await resizeImage(file, 500, 1, "image/png"), "logo.png");
      apply(await api("/store/logo", { method: "PUT", body: fd }));
      setNotice("Logotipo atualizado.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeLogo() {
    setError("");
    try {
      apply(await api("/store/logo", { method: "DELETE" }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="stack-sm" onSubmit={save}>
      <div className="logo-row">
        <div className="logo-box">{logo ? <img src={logo} alt="Logotipo" /> : "Sem logotipo"}</div>
        <div className="row">
          <button type="button" className="secondary small-btn" onClick={() => fileRef.current?.click()}>
            {logo ? "Trocar logotipo" : "Enviar logotipo"}
          </button>
          {logo && <button type="button" className="link small-btn" onClick={removeLogo}>Remover</button>}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onLogo} />
        </div>
      </div>
      <label>
        Nome da papelaria
        <input value={form.name} onChange={set("name")} required maxLength={120} />
      </label>
      <div className="row">
        <label className="grow">
          <span>CNPJ <span className="muted">(opcional)</span></span>
          <input value={form.cnpj} onChange={set("cnpj")} maxLength={20} placeholder="00.000.000/0000-00" />
        </label>
        <label className="grow">
          Telefone
          <input value={form.phone} onChange={set("phone")} maxLength={40} placeholder="(00) 00000-0000" />
        </label>
      </div>
      <label>
        Endereço
        <input value={form.address} onChange={set("address")} maxLength={300} placeholder="Rua, número - Bairro - Cidade/UF" />
      </label>
      <label>
        Mensagem no fim do recibo
        <textarea rows={2} value={form.footer} onChange={set("footer")} maxLength={300} placeholder="Obrigado pela preferência!" />
      </label>
      <fieldset className="plain">
        <legend>Largura do papel da impressora térmica</legend>
        <div className="radio-row">
          {[80, 58].map((w) => (
            <label key={w} className="check">
              <input type="radio" name="paper" value={w} checked={Number(form.paper_width) === w} onChange={set("paper_width")} />
              {w} mm
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="plain">
        <legend>Termo de autorização do fiado</legend>
        <div className="row">
          <label className="grow">
            Instituição (empregador)
            <input value={form.institution} onChange={set("institution")} maxLength={200} placeholder="Colégio …" />
          </label>
          <label className="grow">
            Cidade (para “Local e data”)
            <input value={form.city} onChange={set("city")} maxLength={120} placeholder="Ex.: Porto Alegre" />
          </label>
        </div>
      </fieldset>
      {notice && <div className="success">{notice}</div>}
      {error && <div className="error">{error}</div>}
      <div><button disabled={busy}>{busy ? "Salvando…" : "Salvar dados"}</button></div>
    </form>
  );
}
