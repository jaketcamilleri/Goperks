import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Gift, MessageCircle, Share2, Mail, UserPlus, BadgeCheck, CalendarPlus } from "lucide-react";
import { api } from "@/lib/api";

const copyText = (value, label) =>
  navigator.clipboard?.writeText(value).then(() => toast.success(`${label} copied`), () => toast.error("Couldn't copy"));

function Stat({ icon: Icon, value, label, id }) {
  return (
    <div className="min-w-0 rounded-2xl bg-[#0F3138] p-4" data-testid={`referral-stat-${id}`}>
      <Icon className="h-4 w-4 text-[#EE8A63]" />
      <p className="mt-2 font-display text-3xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs text-[#C2DEDA]">{label}</p>
    </div>
  );
}

function FriendList({ friends }) {
  if (!friends.length) return <p className="mt-3 text-sm text-[#C2DEDA]" data-testid="referral-no-friends">No friends yet. Share your code and they'll show up here.</p>;
  return (
    <ul className="mt-3 divide-y divide-[#2E6470] text-sm" data-testid="referral-friends">
      {friends.map((f, i) => (
        <li key={i} className="flex justify-between gap-3 py-2.5">
          <span className="font-semibold">{f.first_name}</span>
          <span className={f.paid ? "text-[#9FD3B0]" : "text-[#C2DEDA]"}>{f.paid ? "Joined · month earned" : "Signed up, not paid yet"}</span>
        </li>
      ))}
    </ul>
  );
}

/** Member's referral area: their own code + invite link. A free month each when a friend joins and pays. */
export function ReferralCard() {
  const [r, setR] = useState(null);
  useEffect(() => { api.get("/me/referral").then((res) => setR(res.data)).catch(() => setR(null)); }, []);
  if (!r?.link) return null;

  const text = `Join me on Go Perks for local deals and discounts. Use my code ${r.code} or my link and your first year is one month free: ${r.link}`;
  const share = () => (navigator.share ? navigator.share({ title: "Go Perks", text, url: r.link }).catch(() => {}) : copyText(r.link, "Link"));
  const friends = Array.isArray(r.friends) ? r.friends : [];
  const left = Math.max(0, (r.cap ?? 12) - (r.months_this_year ?? 0));
  const btn = "inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-[background-color,transform] active:scale-95";

  return (
    <section className="mt-8 rounded-[28px] bg-[#17434C] p-6 text-[#EAF6F3] sm:p-10" data-testid="referral-card">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#EE8A63]"><Gift className="h-4 w-4" /> Refer a friend</p>
          <h2 className="mt-2 font-display text-3xl font-semibold leading-tight sm:text-4xl">Your friend gets a month off. You get a free month.</h2>
          <p className="mt-3 max-w-lg text-sm text-[#C2DEDA] sm:text-base">Your friend enters your code when they sign up (or uses your link) and pays $44.92 for their first year instead of $49. Once they pay, a free month is saved on your account and added when you next renew. Up to {r.cap} free months a year.</p>

          <p className="mt-7 font-mono text-[11px] uppercase tracking-widest text-[#C2DEDA]">Your referral code</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="rounded-2xl border-2 border-dashed border-[#EE8A63] bg-[#0F3138] px-5 py-3 font-mono text-2xl font-bold tracking-[0.2em] sm:text-3xl" data-testid="referral-code">{r.code}</span>
            <button onClick={() => copyText(r.code, "Code")} className={`${btn} bg-[#EAF6F3] text-[#17434C] hover:bg-white`} data-testid="referral-copy-code-btn"><Copy className="h-4 w-4" /> Copy code</button>
          </div>

          <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-[#C2DEDA]">Or share your link</p>
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#0F3138] p-2 pl-3">
            <span className="min-w-0 flex-1 truncate font-mono text-xs" data-testid="referral-link">{r.link}</span>
            <button onClick={() => copyText(r.link, "Link")} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#EAF6F3] px-3 py-2 text-xs font-bold text-[#17434C] transition-transform active:scale-95" data-testid="referral-copy-btn"><Copy className="h-3.5 w-3.5" /> Copy</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={share} className={`${btn} bg-[#B9512E] hover:bg-[#9A4024]`} data-testid="referral-share-btn"><Share2 className="h-4 w-4" /> Share</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className={`${btn} border border-[#2E6470] hover:bg-[#0F3138]`} data-testid="referral-whatsapp-btn"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
            <a href={`mailto:?subject=${encodeURIComponent("A month off Go Perks for you")}&body=${encodeURIComponent(text)}`} className={`${btn} border border-[#2E6470] hover:bg-[#0F3138]`} data-testid="referral-email-btn"><Mail className="h-4 w-4" /> Email</a>
          </div>
        </div>

        <div className="min-w-0 lg:col-span-5">
          <div className="grid grid-cols-3 gap-2">
            <Stat id="signed" icon={UserPlus} value={friends.length} label="Friends signed up" />
            <Stat id="paid" icon={BadgeCheck} value={friends.filter((f) => f.paid).length} label="Friends joined" />
            <Stat id="months" icon={CalendarPlus} value={r.months_this_year ?? 0} label="Free months earned this year" />
          </div>
          <p className="mt-3 text-sm" data-testid="referral-progress">
            {left === 0 ? "You've earned the most free months for this year." : `${left} more free month${left === 1 ? "" : "s"} available this year.`}
            {r.pending_days > 0 && <span className="block text-[#C2DEDA]" data-testid="referral-pending">{Math.round(r.pending_days / 30)} free month{r.pending_days > 30 ? "s" : ""} waiting, added when you next renew.</span>}
          </p>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-[#C2DEDA]">Your friends</p>
          <FriendList friends={friends} />
        </div>
      </div>
    </section>
  );
}
