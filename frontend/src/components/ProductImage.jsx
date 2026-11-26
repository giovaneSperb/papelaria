import { useEffect, useState } from "react";

// Mostra a imagem ou um quadro vazio se não houver/der erro ao carregar.
export default function ProductImage({ src, size = 48, alt = "" }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);

  const style = { width: size, height: size };
  if (!src || broken) {
    return (
      <div className="thumb empty" style={style} aria-hidden>
        <svg viewBox="0 0 24 24" width={size * 0.45} height={size * 0.45} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </div>
    );
  }
  return <img className="thumb" style={style} src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} />;
}
