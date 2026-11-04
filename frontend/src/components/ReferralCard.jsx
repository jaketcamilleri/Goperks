import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Gift, MessageCircle, Share2 } from "lucide-react";
import { api } from "@/lib/api";

/** Member's personal invite link: a free month each when a friend joins and pays. */
export function ReferralCard() {
  const [r, setR] = useState(null);
  useEffect(() => { api.get("/me/referral").then((res) => setR(res.data)).catch(() => setR(null)); }, []);
  if (!r?.link) return null;

  const text = `Join me on Go Perks for local deals and discounts. Use my link and we both get a free month: ${r.link}`;
  const copy = () => navigator.clipboard?.writeText(r.link).then(() => toast.success("Link copied"), () => toast.error("Couldn't copy"));
  const share = () => (navigator.share ? navigator.share({ title: "Go Perks", text, url: r.link }).catch(() => {}) : copy());
  const left = Math.max(0, r.cap - r.months_this_year);

  return (
    <section className="mt-8 rounded-[24px] bg-[#17434C] p-6 text-[#EAF6F3]" data-testid="referral-card">
      <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#EE8A63]"><Gift className="h-4 w-4" /> Give a month, get a month</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">Invite a friend. You both get a free month.</h2>
      <p className="mt-2 text-sm text-[#C2DEDA]">When a friend joins with your link and pays, a free month is added to both your memberships.</p>
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#0F3138] p-2 pl-3">
        <span className="min-w-0 flex-1 truncate font-mono text-xs" data-testid="referral-link">{r.link}</span>
        <button onClick={copy} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#EAF6F3] px-3 py-2 text-xs font-bold text-[#17434C] transition-transform active:scale-95" data-testid="referral-copy-btn"><Copy className="h-3.5 w-3.5" /> Copy</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={share} className="inline-flex items-center gap-1.5 rounded-full bg-[#B9512E] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[#9A4024]" data-testid="referral-share-btn"><Share2 className="h-4 w-4" /> Share</button>
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[#2E6470] px-4 py-2 text-sm font-semibold hover:bg-[#0F3138]" data-testid="referral-whatsapp-btn"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
      </div>
      <p className="mt-4 text-sm" data-testid="referral-progress"><b>{r.months_this_year}</b> of {r.cap} free months earned this year{left === 0 ? " (that's the most for this year)" : ""}.
        {r.pending_days > 0 && <span className="block text-[#C2DEDA]" data-testid="referral-pending">{Math.round(r.pending_days / 30)} free month{r.pending_days > 30 ? "s" : ""} saved for your next renewal.</span>}</p>
      {r.friends.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm" data-testid="referral-friends">
          {r.friends.map((f, i) => <li key={i} className="flex justify-between gap-3"><span>{f.first_name}</span><span className={f.paid ? "text-[#9FD3B0]" : "text-[#C2DEDA]"}>{f.paid ? "Joined · month earned" : "Signed up, not paid yet"}</span></li>)}
        </ul>
      )}
    </section>
  );
}
