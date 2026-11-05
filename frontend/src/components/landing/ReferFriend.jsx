import { Link } from "react-router-dom";
import { Gift, Share2, CalendarPlus } from "lucide-react";

const STEPS = [
  { icon: Gift, title: "Get your code", text: "Every member has their own referral code on their dashboard.", c: "#FFD166" },
  { icon: Share2, title: "Your friend saves a month", text: "They enter your code when they join and pay $44.92 for their first year instead of $49.", c: "#4CC9F0" },
  { icon: CalendarPlus, title: "You get a free month", text: "Once they pay, a free month is added to your next renewal.", c: "#70E000" },
];

export function ReferFriend() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24" data-testid="refer-friend-section">
      <div className="pop confetti-dots grid gap-10 rounded-[32px] border-[3px] border-[#17434C] bg-[#FFE3EC] p-6 sm:p-10 lg:grid-cols-12 lg:p-14">
        <div className="lg:col-span-5">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#9A4024]">Refer a friend</p>
          <h2 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight text-[#17434C] sm:text-4xl">
            Give a month, <span className="italic text-[#B9512E]">get a month.</span>
          </h2>
          <p className="mt-4 max-w-md text-[#3D5E65] md:text-lg">Share your code: your friend's first year is one month free, and you get a free month at your next renewal. Earn up to 12 free months a year.</p>
          <Link to="/join" className="pop pop-hover mt-7 inline-block rounded-full border-2 border-[#17434C] bg-[#B9512E] px-6 py-3.5 font-bold text-white hover:bg-[#9A4024]" data-testid="refer-friend-join-btn">
            Join and start sharing
          </Link>
        </div>
        <ol className="grid gap-4 sm:grid-cols-3 lg:col-span-7">
          {STEPS.map(({ icon: Icon, title, text, c }, i) => (
            <li key={title} className="rounded-3xl border-2 border-[#17434C] bg-white p-5" data-testid={`refer-friend-step-${i}`}>
              <span className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-full border-2 border-[#17434C] text-[#17434C]" style={{ background: c }}><Icon className="h-5 w-5" /></span>
                <span className="font-mono text-xs font-bold text-[#9A4024]">0{i + 1}</span>
              </span>
              <p className="mt-4 font-display text-lg font-semibold text-[#17434C]">{title}</p>
              <p className="mt-1 text-sm text-[#3D5E65]">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
