import { Link } from "react-router-dom";
import { CalendarPlus } from "lucide-react";

/** Reminds a member that free months earned from referrals are added to their next year. */
export function BonusMonthsNote({ user }) {
  const months = Math.round((user?.bonus_days_pending ?? 0) / 30);
  if (months < 1) return null;
  const active = user?.membership_status === "active";
  const exp = user?.membership_expires_at ? new Date(user.membership_expires_at) : null;
  const soon = !active || (exp && exp - Date.now() < 30 * 864e5);
  const ends = exp ? exp.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : null;
  const plural = months === 1 ? "" : "s";

  return (
    <div className="mt-6 flex gap-3 rounded-[24px] border border-[#EE8A63] bg-[#FDF0EC] p-5" data-testid="bonus-months-note">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#B9512E] text-[#EAF6F3]"><CalendarPlus className="h-5 w-5" /></span>
      <div>
        <p className="font-display text-lg font-semibold text-[#17434C]" data-testid="bonus-months-title">
          {months} free month{plural} saved for your next year
        </p>
        <p className="mt-1 text-sm text-[#3D5E65]" data-testid="bonus-months-text">
          Thanks for referring friends. {active && ends ? `When you renew (your membership ends ${ends}), ` : "When you renew, "}
          your next year runs <b>{12 + months} months</b> for the usual $49.
        </p>
        {soon && (
          <Link to="/join" className="mt-3 inline-flex rounded-full bg-[#B9512E] px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-[#9A4024] active:scale-[0.98]" data-testid="bonus-months-renew-btn">
            Renew and use my free month{plural}
          </Link>
        )}
      </div>
    </div>
  );
}
