const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const formatBRL = (v) => brl.format(Number(v) || 0);

// Aceita "12,50", "12.50", "1.234,56"
export function parsePrice(text) {
  let s = String(text).trim().replace(/[^\d,.-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

export const priceToInput = (v) => Number(v).toFixed(2).replace(".", ",");
