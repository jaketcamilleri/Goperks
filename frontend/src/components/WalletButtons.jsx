import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { assetUrl } from "@/lib/site";


export function WalletButtons() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/wallet/status").then((r) => setReady(!!r.data?.apple)).catch(() => setReady(false));
  }, []);

  const apple = async () => {
    setBusy(true);
    await api.post("/auth/refresh").catch(() => {});
    window.location.href = assetUrl("/api/wallet/apple");
    setTimeout(() => setBusy(false), 3000);
  };

  if (!ready) return null;

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row" data-testid="wallet-buttons">
      <button onClick={apple} disabled={busy} data-testid="add-apple-wallet-btn"
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#0F3138] px-5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-60">
        <Wallet className="h-4 w-4" /> {busy ? "Preparing…" : "Add to Apple Wallet"}
      </button>
    </div>
  );
}
