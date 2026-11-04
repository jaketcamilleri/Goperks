import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BadgeCheck } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Stars, StarInput } from "@/components/Stars";

function Summary({ reviews }) {
  const n = reviews.length;
  const avg = n ? reviews.reduce((s, r) => s + r.rating, 0) / n : 0;
  const dist = [5, 4, 3, 2, 1].map((k) => [k, reviews.filter((r) => r.rating === k).length]);
  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-[#D3ECE7] bg-white p-6 sm:flex-row sm:items-center" data-testid="reviews-summary">
      <div className="text-center sm:w-40">
        <p className="font-display text-5xl font-semibold" data-testid="reviews-average">{n ? avg.toFixed(1) : "–"}</p>
        <Stars value={avg} className="mt-1" />
        <p className="mt-1 text-sm text-[#3D5E65]" data-testid="reviews-count">{n} review{n === 1 ? "" : "s"}</p>
      </div>
      <ul className="flex-1 space-y-1.5">
        {dist.map(([k, c]) => (
          <li key={k} className="flex items-center gap-3 text-sm">
            <span className="w-3 font-semibold">{k}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#EAF6F3]"><span className="block h-full rounded-full bg-[#E39A2D]" style={{ width: `${n ? (c / n) * 100 : 0}%` }} /></span>
            <span className="w-6 text-right text-[#3D5E65]">{c}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewForm({ dealId, mine, onSaved }) {
  const [rating, setRating] = useState(mine?.rating || 0);
  const [comment, setComment] = useState(mine?.comment || "");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!rating) { toast.error("Pick a star rating first"); return; }
    setBusy(true);
    try { await api.post(`/deals/${dealId}/reviews`, { rating, comment }); toast.success(mine ? "Review updated" : "Thanks for your review!"); onSaved(); }
    catch (err) { toast.error(formatErr(err)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="rounded-2xl border border-[#C2DEDA] bg-[#F4FAF8] p-5" data-testid="review-submission-form">
      <p className="font-semibold">{mine ? "Update your review" : "How was it?"}</p>
      <div className="mt-2"><StarInput value={rating} onChange={setRating} /></div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3} placeholder="Tell other members what you loved (optional)"
        className="mt-3 w-full rounded-xl border border-[#C2DEDA] bg-white p-3 text-sm outline-none focus:border-[#17434C]" data-testid="review-comment-input" />
      <button disabled={busy} className="mt-3 rounded-full bg-[#B9512E] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#9A4024] disabled:opacity-60" data-testid="review-submit-btn">
        {busy ? "Saving…" : mine ? "Update review" : "Post review"}
      </button>
    </form>
  );
}

export function Reviews({ dealId, onChange }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const load = () => api.get(`/deals/${dealId}/reviews`).then((r) => setData(r.data || null)).catch(() => setData({ reviews: [] }));
  useEffect(() => { load(); }, [dealId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (data && window.location.hash === "#reviews") document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" });
  }, [data]);
  const reviews = Array.isArray(data?.reviews) ? data.reviews : [];

  return (
    <section id="reviews" className="mt-16" data-testid="deal-reviews">
      <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Member reviews</h2>
      <p className="mt-1 text-sm text-[#3D5E65]">Only members who've used this deal can review it.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <Summary reviews={reviews} />
          {data?.can_review ? <ReviewForm key={data?.mine?.id || "new"} dealId={dealId} mine={data?.mine} onSaved={() => { load(); onChange?.(); }} />
            : user?.role === "member" ? <p className="rounded-2xl border border-dashed border-[#C2DEDA] p-5 text-sm text-[#3D5E65]" data-testid="review-locked-note">Used this deal? Once it's redeemed you can rate it here.</p>
            : !user ? <p className="rounded-2xl border border-dashed border-[#C2DEDA] p-5 text-sm text-[#3D5E65]" data-testid="review-login-note"><Link to={`/login?next=/deals/${dealId}`} className="font-semibold text-[#9A4024]">Log in</Link> to review deals you've used.</p> : null}
        </div>
        <ul className="space-y-3 lg:col-span-7" data-testid="reviews-list">
          {reviews.length === 0 && <li className="rounded-2xl bg-white p-6 text-[#3D5E65]" data-testid="reviews-empty">No reviews yet. Be the first after you visit.</li>}
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl border border-[#D3ECE7] bg-white p-5" data-testid={`review-${r.id}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[#D3ECE7] font-display font-semibold">{r.name?.[0] || "M"}</span>
                  <span><span className="block font-semibold">{r.name}</span><span className="flex items-center gap-1 text-xs text-[#4E7A58]"><BadgeCheck className="h-3.5 w-3.5" /> Used this deal</span></span>
                </span>
                <span className="text-right"><Stars value={r.rating} size="h-3.5 w-3.5" /><span className="block text-xs text-[#3D5E65]">{new Date(r.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span></span>
              </div>
              {r.comment && <p className="mt-3 text-[#17434C]">{r.comment}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
