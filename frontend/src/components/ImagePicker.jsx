import { useRef, useState } from "react";
import ProductImage from "./ProductImage.jsx";
import { resizeImage } from "../image.js";

// Abre o Google Imagens numa aba nova com o termo pesquisado
function GoogleButton({ term, label, emptyHint }) {
  const q = (term || "").trim();
  if (!q) {
    return (
      <button type="button" className="secondary small-btn" disabled title={emptyHint}>
        {label}
      </button>
    );
  }
  return (
    <a
      className="btn-secondary small-btn"
      href={`https://www.google.com/search?udm=2&q=${encodeURIComponent(q)}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
    </a>
  );
}

/*
  value: { kind: "keep" } | { kind: "none" } | { kind: "url", url } | { kind: "file", blob, preview }
  current: imagem que o produto já tem (para "keep")
  name / barcode: usados nos botões de pesquisa no Google Imagens
*/
export default function ImagePicker({ value, onChange, current, name, barcode }) {
  const fileRef = useRef(null);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");

  const preview =
    value.kind === "keep" ? current :
    value.kind === "url" ? value.url :
    value.kind === "file" ? value.preview : null;

  async function useBlob(fileOrBlob) {
    setError("");
    try {
      const blob = await resizeImage(fileOrBlob);
      onChange({ kind: "file", blob, preview: URL.createObjectURL(blob) });
      setLink("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await useBlob(file);
  }

  // Aceita um link http(s) ou uma imagem "data:" (o Google às vezes copia assim)
  async function useLink(text) {
    const t = text.trim();
    if (!t) return;
    setError("");
    if (t.startsWith("data:image/")) {
      try {
        await useBlob(await (await fetch(t)).blob());
      } catch {
        setError("Não foi possível usar essa imagem.");
      }
      return;
    }
    let url;
    try {
      url = new URL(t);
    } catch {
      return setError("Isso não parece um link de imagem.");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return setError("Use um link que comece com https://");
    }
    onChange({ kind: "url", url: url.href });
    setLink("");
  }

  // Ctrl+V: se a área de transferência tiver uma imagem, usa ela direto
  async function onPaste(e) {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
    if (item) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) await useBlob(file);
      return;
    }
    const text = e.clipboardData?.getData("text") || "";
    if (/^(https?:|data:image\/)/i.test(text.trim())) {
      e.preventDefault();
      await useLink(text);
    }
  }

  return (
    <div className="image-picker" onPaste={onPaste}>
      <ProductImage src={preview} size={120} />
      <div className="image-side">
        <div className="row">
          <button type="button" className="secondary small-btn" onClick={() => fileRef.current?.click()}>
            Enviar foto
          </button>
          <GoogleButton term={name} label="Google: nome" emptyHint="Digite o nome do produto primeiro" />
          <GoogleButton term={barcode} label="Google: código" />
          {preview && (
            <button type="button" className="link small-btn" onClick={() => onChange({ kind: "none" })}>
              Remover
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        </div>

        <div className="row paste-row">
          <input
            className="grow"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // não envia o formulário
                useLink(link);
              }
            }}
            placeholder="Cole aqui a imagem (Ctrl+V) ou o link dela"
            aria-label="Colar imagem ou link"
          />
          {link.trim() && (
            <button type="button" className="secondary small-btn" onClick={() => useLink(link)}>
              Usar link
            </button>
          )}
        </div>

        <p className="muted small-left">
          Pesquise no Google, clique com o botão direito na imagem, "Copiar imagem" e cole acima.
        </p>
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
