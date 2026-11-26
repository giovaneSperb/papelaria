import { useEffect, useRef, useState } from "react";

const SCAN_INTERVAL_MS = 100;

export default function CameraScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [status, setStatus] = useState("Abrindo câmera…");
  const [error, setError] = useState("");

  useEffect(() => {
    let stopped = false;
    let stream = null;
    let timer = null;

    const stopAll = () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Câmera indisponível. Ela só funciona em HTTPS ou em localhost.");
        return;
      }
      try {
        const [s, { createVideoReader }] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          }),
          import("../barcode.js"),
        ]);
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;

        // Foco contínuo quando a câmera permite (ajuda muito em códigos de perto)
        const [track] = s.getVideoTracks();
        const caps = track.getCapabilities?.() ?? {};
        if (caps.focusMode?.includes("continuous")) {
          track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
        }

        const video = videoRef.current;
        video.srcObject = s;
        await video.play();
        if (stopped) return;

        const read = createVideoReader();
        setStatus("Aproxime até o código preencher a moldura");

        const loop = async () => {
          if (stopped) return;
          let code = null;
          try {
            code = await read(video);
          } catch {
            /* quadro ruim, tenta o próximo */
          }
          if (stopped) return;
          if (code) {
            navigator.vibrate?.(80);
            stopAll();
            onDetectedRef.current(code);
            return;
          }
          timer = setTimeout(loop, SCAN_INTERVAL_MS);
        };
        loop();
      } catch (e) {
        if (stopped) return;
        setError(
          e?.name === "NotAllowedError"
            ? "Permissão da câmera negada. Libere o acesso nas configurações do navegador."
            : e?.name === "NotFoundError"
            ? "Nenhuma câmera encontrada."
            : e?.name === "NotReadableError"
            ? "A câmera está sendo usada por outro aplicativo."
            : "Não foi possível abrir a câmera."
        );
      }
    })();

    return stopAll;
  }, []);

  return (
    <div className="scanner">
      {error ? (
        <div className="error">{error}</div>
      ) : (
        <div className="scanner-view">
          <video ref={videoRef} muted playsInline autoPlay />
          <div className="scanner-guide" aria-hidden />
          <span className="scanner-status">{status}</span>
        </div>
      )}
      <button type="button" className="secondary" onClick={onClose}>Fechar câmera</button>
    </div>
  );
}
