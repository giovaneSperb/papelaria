import { useEffect, useState } from "react";
import { api } from "../api.js";

// Logotipo + nome da papelaria para as telas sem login (dados públicos)
export default function Brand({ subtitle }) {
  const [brand, setBrand] = useState(null);

  useEffect(() => {
    api("/store/brand").then(setBrand).catch(() => setBrand({ name: "Papelaria", logo: null }));
  }, []);

  return (
    <div className="auth-brand">
      {brand?.logo && <img src={brand.logo} alt="" />}
      <h1>{brand?.name ?? " "}</h1>
      {subtitle && <p className="muted">{subtitle}</p>}
    </div>
  );
}
