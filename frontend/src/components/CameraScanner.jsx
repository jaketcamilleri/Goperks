import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export function CameraScanner({ onScan, onClose }) {
  const ref = useRef(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const scanner = new Html5Qrcode("lp-scanner");
    ref.current = scanner;
    let stopped = false;
    scanner
      .start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 220 } }, (text) => {
        if (stopped) return;
        stopped = true;
        scanner.stop().catch(() => {}).finally(() => onScan(text.trim().toUpperCase()));
      })
      .catch(() => setErr("We couldn't open the camera. Allow camera access in your browser, or type the code instead."));
    return () => {
      stopped = true;
      if (scanner.isScanning) scanner.stop().catch(() => {});
    };
  }, [onScan]);

  return (
    <div className="mt-5 overflow-hidden rounded-2xl bg-black/40 p-3" data-testid="camera-scanner">
      <div id="lp-scanner" className="mx-auto w-full max-w-sm overflow-hidden rounded-xl" />
      {err && <p className="mt-3 rounded-xl bg-[#FDF0EC] p-3 text-sm text-[#9A4024]" data-testid="camera-error">{err}</p>}
      <button type="button" onClick={onClose} data-testid="camera-close-btn" className="mt-3 w-full rounded-full border border-white/30 py-3 text-sm font-semibold">
        Close camera
      </button>
    </div>
  );
}
