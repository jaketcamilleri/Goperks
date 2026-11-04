import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { api, formatErr } from "@/lib/api";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

export function WalletButtons() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api.get("/wallet/status").then((r) => setStatus(r.data || {})).catch(() => setStatus({}));
  }, []);

  const apple = async () => {
    setBusy("apple");
    await api.post("/auth/refresh").catch(() => {});
    window.location.href = `${BACKEND}/api/wallet/apple`;
    setTimeout(() => setBusy(""), 3000);
  };

  const google = async () => {
    setBusy("google");
    try {
      const { data } = await api.get("/wallet/google");
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      toast.error(formatErr(e));
    } finally {
      setBusy("");
    }
  };

  if (!status || (!status.apple && !status.google)) {
    return (
      <p className="mt-4 flex items-center gap-2 text-sm text-[#3D5E65]" data-testid="wallet-coming-soon">
        <Wallet className="h-4 w-4" /> Apple Wallet & Google Wallet cards are coming soon.
      </p>
    );
  }

  const cls = "flex h-12 items-center justify-center gap-2 rounded-full bg-[#0F3138] px-5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-60";
  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row" data-testid="wallet-buttons">
      {status.apple && (
        <button onClick={apple} disabled={busy === "apple"} className={cls} data-testid="add-apple-wallet-btn">
          <Wallet className="h-4 w-4" /> {busy === "apple" ? "Preparing…" : "Add to Apple Wallet"}
        </button>
      )}
      {status.google && (
        <button onClick={google} disabled={busy === "google"} className={cls} data-testid="add-google-wallet-btn">
          <Wallet className="h-4 w-4" /> {busy === "google" ? "Preparing…" : "Add to Google Wallet"}
        </button>
      )}
    </div>
  );
}
