// Leitura de códigos de barras. Carregado só quando o usuário abre a câmera.
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

// Serve o .wasm do próprio site (sem depender de CDN)
prepareZXingModule({
  overrides: {
    locateFile: (path, prefix) => (path.endsWith(".wasm") ? wasmUrl : prefix + path),
  },
});

const ZXING_OPTIONS = {
  formats: ["EAN13", "EAN8", "UPCA", "UPCE", "Code128", "Code39", "ITF"],
  tryHarder: true,
  maxNumberOfSymbols: 1,
};

const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"];

let nativeDetector; // undefined = ainda não testado, null = indisponível

// Leitor nativo do navegador (Chrome/Android, Safari recente no macOS…)
async function getNativeDetector() {
  if (nativeDetector !== undefined) return nativeDetector;
  nativeDetector = null;
  if ("BarcodeDetector" in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
      if (formats.length) nativeDetector = new window.BarcodeDetector({ formats });
    } catch {
      /* sem suporte */
    }
  }
  return nativeDetector;
}

async function readNative(source) {
  const detector = await getNativeDetector();
  if (!detector) return null;
  try {
    return (await detector.detect(source))[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}

async function readZxing(input) {
  const results = await readBarcodes(input, ZXING_OPTIONS);
  return results.find((r) => r.isValid)?.text ?? null;
}

/** Cria um leitor de quadros de vídeo. Retorna o código lido ou null. */
export function createVideoReader() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  return async (video) => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;

    const native = await readNative(video);
    if (native) return native;

    // Faixa central (onde fica a mira): menos pixels = leitura mais rápida
    const cropH = Math.round(h * 0.6);
    canvas.width = w;
    canvas.height = cropH;
    ctx.drawImage(video, 0, (h - cropH) / 2, w, cropH, 0, 0, w, cropH);
    return readZxing(ctx.getImageData(0, 0, w, cropH));
  };
}

/** Lê o código de uma foto (arquivo da câmera do celular ou galeria). */
export async function readFromFile(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const native = await readNative(bitmap);
    bitmap.close?.();
    if (native) return native;
  } catch {
    /* segue para o ZXing */
  }
  return readZxing(file);
}
