// Imprime sem sair da tela: carrega a página num iframe invisível e abre a
// janela de impressão quando ela avisar que está pronta ("print-ready").
export const printReceipt = (saleId) => printPage(`/recibo/${saleId}?embed=1`);
export const printTerm = (saleId) => printPage(`/termo/${saleId}?embed=1`);
export const printClosing = (day) => printPage(`/fechamento/impressao?data=${day}&embed=1`);

function printPage(url) {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      setTimeout(() => iframe.remove(), 500);
      resolve();
    };

    function onMessage(e) {
      if (e.source !== iframe.contentWindow || e.data?.type !== "print-ready") return;
      const w = iframe.contentWindow;
      w.addEventListener("afterprint", finish, { once: true });
      w.focus();
      w.print();
      setTimeout(finish, 120000); // garantia caso o navegador não avise o fim
    }

    window.addEventListener("message", onMessage);
    iframe.src = url;
    document.body.appendChild(iframe);
  });
}

export const openReceipt = (saleId, format) =>
  window.open(`/recibo/${saleId}${format ? `?formato=${format}` : ""}`, "_blank", "noopener");
export const openTerm = (saleId) => window.open(`/termo/${saleId}`, "_blank", "noopener");
export const openClosing = (day, format) =>
  window.open(`/fechamento/impressao?data=${day}${format ? `&formato=${format}` : ""}`, "_blank", "noopener");

// Preferência deste computador: imprimir sozinho ao finalizar a venda
const AUTO_KEY = "papelaria_auto_print";
export function getAutoPrint() {
  try {
    return localStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
}
export function setAutoPrint(on) {
  try {
    localStorage.setItem(AUTO_KEY, on ? "1" : "0");
  } catch {
    /* navegador sem armazenamento: só não lembra a escolha */
  }
}
