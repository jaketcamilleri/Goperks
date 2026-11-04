import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Printer, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LogoStacked } from "@/components/Logo";
import { bp, MAIN_URL } from "@/lib/site";

function Sticker({ businessName, url }) {
  return (
    <div className="sticker-sheet mx-auto aspect-square w-full max-w-[520px] rounded-full bg-[#17434C] p-[6%] text-[#EAF6F3] shadow-[0_40px_80px_-30px_rgba(23,67,76,0.6)]" data-testid="window-sticker">
      <div className="flex h-full w-full flex-col items-center justify-center rounded-full border-[3px] border-dashed border-[#EE8A63] p-[8%] text-center">
        <LogoStacked light className="h-24 w-auto sm:h-28" />
        <p className="mt-3 font-display text-xl font-semibold leading-tight sm:text-2xl">Members save here</p>
        {businessName && <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-[#BFD9D6] sm:text-xs" data-testid="sticker-business-name">{businessName}</p>}
        <div className="mt-4 rounded-xl bg-white p-2"><QRCodeSVG value={url} size={96} level="M" fgColor="#17434C" /></div>
        <p className="mt-2 text-[11px] text-[#BFD9D6] sm:text-xs">Scan to join for $49/year</p>
      </div>
    </div>
  );
}

export default function StickerPage() {
  const { user } = useAuth();
  const url = `${MAIN_URL}/join`;
  return (
    <div className="mx-auto max-w-4xl px-5 pb-24 pt-10 sm:px-8" data-testid="sticker-page">
      <div className="print-hide">
        <Link to={bp("")} className="inline-flex items-center gap-2 text-sm font-semibold" data-testid="sticker-back-link"><ArrowLeft className="h-4 w-4" /> Partner portal</Link>
        <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Your window sticker</h1>
        <p className="mt-3 max-w-xl text-[#3D5E65]">Print it on sticker paper (about 12 cm round) and pop it on your door or counter so members know to ask. Choose "Save as PDF" in the print window to keep a copy or send it to a printer.</p>
        <button onClick={() => window.print()} data-testid="sticker-print-btn"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#B9512E] px-7 py-4 font-semibold text-[#EAF6F3] transition-[background-color,transform] hover:bg-[#9A4024] active:scale-95">
          <Printer className="h-5 w-5" /> Print or save as PDF
        </button>
      </div>
      <div className="mt-12 print:mt-0">
        <Sticker businessName={user?.business_name} url={url} />
      </div>
    </div>
  );
}
