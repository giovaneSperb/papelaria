import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import CameraScanner from "../components/CameraScanner.jsx";
import ImagePicker from "../components/ImagePicker.jsx";
import PhotoScanButton from "../components/PhotoScanButton.jsx";
import ProductImage from "../components/ProductImage.jsx";
import { formatBRL, parsePrice, priceToInput } from "../format.js";

const emptyForm = { name: "", quantity: "", price: "" };

export default function Stock() {
  const scanRef = useRef(null);
  const nameRef = useRef(null);

  const [code, setCode] = useState("");
  const [camera, setCamera] = useState(false);
  const [looking, setLooking] = useState(false);

  // editing: null (nada aberto) | { mode: "new", barcode } | { mode: "edit", product }
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [image, setImage] = useState({ kind: "none" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");

  const loadProducts = useCallback(async (q = "") => {
    try {
      setProducts(await api(`/products${q ? `?q=${encodeURIComponent(q)}` : ""}`));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadProducts(search), 250);
    return () => clearTimeout(t);
  }, [search, loadProducts]);

  useEffect(() => {
    if (editing) nameRef.current?.focus();
    else scanRef.current?.focus();
  }, [editing]);

  // Libera a memória das prévias de fotos locais
  useEffect(() => {
    if (image.kind !== "file") return;
    return () => URL.revokeObjectURL(image.preview);
  }, [image]);

  function openEdit(product) {
    setEditing({ mode: "edit", product });
    setForm({
      name: product.name,
      quantity: String(product.quantity),
      price: priceToInput(product.price),
    });
    setImage({ kind: product.image ? "keep" : "none" });
    setError("");
    setNotice("");
  }

  // Procura o código no estoque: se existe abre a edição, senão abre o cadastro
  const lookup = useCallback(
    async (barcode) => {
      barcode = barcode.trim();
      if (!barcode) return;
      setCamera(false);
      setLooking(true);
      setError("");
      setNotice("");
      try {
        openEdit(await api(`/products/barcode/${encodeURIComponent(barcode)}`));
      } catch (e) {
        if (e.status === 404) {
          setEditing({ mode: "new", barcode });
          setForm(emptyForm);
          setImage({ kind: "none" });
        } else {
          setError(e.message);
        }
      } finally {
        setLooking(false);
        setCode("");
      }
    },
    []
  );

  function cancel() {
    setEditing(null);
    setForm(emptyForm);
    setImage({ kind: "none" });
    setError("");
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    const price = parsePrice(form.price);
    const quantity = Number(form.quantity);
    if (Number.isNaN(price) || price < 0) return setError("Valor de venda inválido");
    if (!Number.isInteger(quantity) || quantity < 0) return setError("Quantidade inválida");

    const body = { name: form.name, quantity, price };
    if (image.kind === "url") body.image_url = image.url;

    setSaving(true);
    let saved;
    try {
      if (editing.mode === "new") {
        saved = await api("/products", { method: "POST", body: { ...body, barcode: editing.barcode } });
      } else {
        saved = await api(`/products/${editing.product.id}`, { method: "PUT", body });
        if (image.kind === "none" && editing.product.image) {
          await api(`/products/${saved.id}/image`, { method: "DELETE" });
        }
      }
    } catch (err) {
      setSaving(false);
      return setError(err.message);
    }

    let msg = `"${form.name}" ${editing.mode === "new" ? "cadastrado" : "atualizado"}.`;
    if (image.kind === "file") {
      try {
        const fd = new FormData();
        fd.append("file", image.blob, "foto.jpg");
        await api(`/products/${saved.id}/image`, { method: "PUT", body: fd });
      } catch (err) {
        msg += ` Mas a foto não foi enviada: ${err.message}`;
      }
    }

    setSaving(false);
    setNotice(msg);
    setEditing(null);
    setForm(emptyForm);
    setImage({ kind: "none" });
    loadProducts(search);
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const barcode = editing ? (editing.mode === "new" ? editing.barcode : editing.product.barcode) : "";

  return (
    <div className="stack">
      <h2>Estoque</h2>

      {!editing && (
        <section className="panel">
          <form
            className="scan-row"
            onSubmit={(e) => {
              e.preventDefault();
              lookup(code);
            }}
          >
            <label className="grow">
              Código de barras
              <input
                ref={scanRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Escaneie ou digite e tecle Enter"
                inputMode="numeric"
                autoComplete="off"
              />
            </label>
            <button disabled={looking || !code.trim()}>{looking ? "Buscando…" : "Buscar"}</button>
            <button type="button" className="secondary" onClick={() => setCamera((c) => !c)}>
              {camera ? "Fechar câmera" : "Usar câmera"}
            </button>
            <PhotoScanButton onDetected={lookup} onError={(m) => { setNotice(""); setError(m); }} />
          </form>
          {camera && <CameraScanner onDetected={lookup} onClose={() => setCamera(false)} />}
          {notice && <div className="success">{notice}</div>}
          {error && <div className="error">{error}</div>}
        </section>
      )}

      {editing && (
        <form className="panel" onSubmit={save}>
          <div className="panel-head">
            <h3>{editing.mode === "new" ? "Novo produto" : "Editar produto"}</h3>
            <code>{barcode}</code>
          </div>
          {editing.mode === "new" && (
            <p className="muted">Código não encontrado no estoque. Preencha para cadastrar.</p>
          )}
          <ImagePicker
            value={image}
            onChange={setImage}
            current={editing.mode === "edit" ? editing.product.image : null}
            name={form.name}
            barcode={barcode}
          />
          <label>
            Nome do produto
            <input ref={nameRef} value={form.name} onChange={set("name")} required maxLength={200} />
          </label>
          <div className="row">
            <label className="grow">
              Quantidade
              <input type="number" min="0" step="1" value={form.quantity} onChange={set("quantity")} required />
            </label>
            <label className="grow">
              Valor de venda (R$)
              <input inputMode="decimal" placeholder="0,00" value={form.price} onChange={set("price")} required />
            </label>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="row">
            <button disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
            <button type="button" className="secondary" onClick={cancel}>Cancelar</button>
          </div>
        </form>
      )}

      <section className="panel">
        <div className="panel-head">
          <h3>Produtos</h3>
          <input
            className="search"
            placeholder="Buscar por nome ou código"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {products.length === 0 ? (
          <p className="muted">Nenhum produto encontrado.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Código</th>
                  <th>Nome</th>
                  <th className="num">Qtd.</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} onClick={() => openEdit(p)} title="Clique para editar">
                    <td className="thumb-cell"><ProductImage src={p.image} size={40} /></td>
                    <td><code>{p.barcode}</code></td>
                    <td>{p.name}</td>
                    <td className={`num ${p.quantity === 0 ? "zero" : ""}`}>{p.quantity}</td>
                    <td className="num">{formatBRL(p.price)}</td>
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
