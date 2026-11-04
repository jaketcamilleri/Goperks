import { Link } from "react-router-dom";
import { Gift, Share2, CalendarPlus } from "lucide-react";

const STEPS = [
  { icon: Gift, title: "Get your code", text: "Every member has their own referral code on their dashboard." },
  { icon: Share2, title: "Share it with a friend", text: "Send your code or invite link by text, WhatsApp or email." },
  { icon: CalendarPlus, title: "You both get a free month", text: "When your friend joins and pays, a month is added to both memberships." },
];

export function ReferFriend() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24" data-testid="refer-friend-section">
      <div className="grid gap-10 rounded-[32px] bg-[#FDF0EC] p-6 sm:p-10 lg:grid-cols-12 lg:p-14">
        <div className="lg:col-span-5">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#9A4024]">Refer a friend</p>
          <h2 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight text-[#17434C] sm:text-4xl">
            Give a month, <span className="italic text-[#B9512E]">get a month.</span>
          </h2>
          <p className="mt-4 max-w-md text-[#3D5E65] md:text-lg">Bring a friend into the club and you'll both get a free month. Earn up to 12 free months a year.</p>
          <Link to="/join" className="mt-7 inline-block rounded-full bg-[#B9512E] px-6 py-3.5 font-semibold text-white transition-[background-color,transform] hover:bg-[#9A4024] active:scale-[0.98]" data-testid="refer-friend-join-btn">
            Join and start sharing
          </Link>
        </div>
        <ol className="grid gap-4 sm:grid-cols-3 lg:col-span-7">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-2xl bg-white p-5" data-testid={`refer-friend-step-${i}`}>
              <span className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#17434C] text-[#EAF6F3]"><Icon className="h-5 w-5" /></span>
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
