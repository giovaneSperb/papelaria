import { useEffect, useId, useRef, useState } from "react";
import { api } from "../api.js";
import { formatBRL } from "../format.js";
import ProductImage from "./ProductImage.jsx";

const MIN_CHARS = 3;
const DEBOUNCE_MS = 200;
const MAX_ITEMS = 8;

// Tira acento e põe em minúsculas, caractere a caractere (mantém as posições do texto original)
const fold = (c) => c.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Destaca no nome as partes que combinam com o que foi digitado (ignorando acentos)
function Highlight({ text, query }) {
  const chars = [...text];
  const folded = chars.map(fold).join("");
  if (folded.length !== chars.length) return text; // caractere raro que muda de tamanho: sem destaque
  const marks = new Array(chars.length).fill(false);
  for (const word of [...new Set(query.split(/\s+/).map((w) => [...w].map(fold).join("")))].filter(Boolean)) {
    let i = folded.indexOf(word);
    while (i !== -1) {
      for (let k = i; k < i + word.length; k++) marks[k] = true;
      i = folded.indexOf(word, i + word.length);
    }
  }
  const parts = [];
  chars.forEach((c, i) => {
    const last = parts[parts.length - 1];
    if (last && last.mark === marks[i]) last.text += c;
    else parts.push({ text: c, mark: marks[i] });
  });
  return parts.map((p, i) => (p.mark ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>));
}

/*
  Campo de produto com lista de sugestões a partir do 3º caractere.
  - Enter com um item marcado (setas ↑↓ ou mouse) → onPick(produto)
  - Enter sem item marcado → segue o envio normal do formulário (leitor de código de barras)
  paused: não abre a lista (ex.: enquanto a página está buscando o código bipado)
*/
export default function ProductAutocomplete({ id, inputRef, value, onChange, onPick, paused = false, placeholder }) {
  const listId = useId();
  const seq = useRef(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [lastQuery, setLastQuery] = useState("");

  useEffect(() => {
    const term = value.trim();
    const mine = ++seq.current; // respostas antigas são ignoradas
    if (paused || term.length < MIN_CHARS) {
      setOpen(false);
      setItems([]);
      setActive(-1);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const found = await api(`/products?q=${encodeURIComponent(term)}&limit=${MAX_ITEMS}`);
        if (mine !== seq.current) return;
        setItems(found);
        setLastQuery(term);
        setActive(-1);
        setOpen(document.activeElement === inputRef.current);
      } catch {
        if (mine === seq.current) setItems([]);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, paused, inputRef]);

  function pick(product) {
    seq.current++;
    setOpen(false);
    setItems([]);
    setActive(-1);
    onPick(product);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      if (!items.length) return;
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      if (!open || !items.length) return;
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      if (open && active >= 0 && items[active]) {
        e.preventDefault(); // não envia o formulário
        pick(items[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    }
  }

  const showList = open && !paused && value.trim().length >= MIN_CHARS;

  return (
    <div className="ac">
      <input
        id={id}
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
      />
      {loading && value.trim().length >= MIN_CHARS && !paused && <span className="ac-spinner" aria-hidden />}
      {showList && (
        <ul className="ac-list" role="listbox" id={listId}>
          {items.length === 0 ? (
            <li className="ac-empty">Nenhum produto encontrado para “{lastQuery}”.</li>
          ) : (
            items.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`ac-item ${i === active ? "active" : ""}`}
                onMouseDown={(e) => e.preventDefault()} // mantém o foco no campo
                // onMouseMove (e não onMouseEnter): a lista abrindo embaixo do mouse parado
                // não deve marcar um item sozinha, senão o Enter adicionaria algo não escolhido
                onMouseMove={() => active !== i && setActive(i)}
                onClick={() => pick(p)}
              >
                <ProductImage src={p.image} size={36} />
                <div className="ac-main">
                  <div className="ac-name"><Highlight text={p.name} query={value} /></div>
                  <div className="ac-sub">{p.barcode}</div>
                </div>
                <div className="ac-side">
                  <div className="ac-price">{formatBRL(p.price)}</div>
                  <div className={p.quantity === 0 ? "zero" : "ac-sub"}>
                    {p.quantity === 0 ? "sem estoque" : `${p.quantity} em estoque`}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
