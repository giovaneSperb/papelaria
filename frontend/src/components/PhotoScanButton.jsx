import { useRef, useState } from "react";

// Tira uma foto com o app de câmera do aparelho (foco automático, resolução máxima)
// e lê o código nela. É o modo mais confiável no celular.
export default function PhotoScanButton({ onDetected, onError }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { readFromFile } = await import("../barcode.js");
      const code = await readFromFile(file);
      if (code) onDetected(code);
      else onError("Não encontrei código de barras na foto. Tente mais perto e com o código reto.");
    } catch {
      onError("Não foi possível ler a foto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "Lendo foto…" : "Tirar foto do código"}
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
    </>
  );
}
