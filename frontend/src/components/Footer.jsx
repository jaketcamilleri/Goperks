import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#12161A] text-[#FBF8F3]" data-testid="site-footer">
      <div className="mx-auto max-w-7xl px-5 pb-10 pt-20 sm:px-8">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-6">
            <Logo light />
            <p className="mt-6 max-w-sm text-[#C9CED6]">A little local club, for everyone. One yearly membership, every deal in the club.</p>
          </div>
          <div className="md:col-span-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#F3A72E]">Explore</p>
            <ul className="mt-4 space-y-2 text-[#E5DEC9]">
              <li><Link to="/deals" className="hover:text-white">All deals</Link></li>
              <li><Link to="/join" className="hover:text-white">Membership</Link></li>
              <li><Link to="/dashboard" className="hover:text-white">My card</Link></li>
            </ul>
          </div>
          <div className="md:col-span-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#F3A72E]">Partners</p>
            <ul className="mt-4 space-y-2 text-[#E5DEC9]">
              <li><Link to="/business" className="hover:text-white">List your deal</Link></li>
              <li><Link to="/login" className="hover:text-white">Partner login</Link></li>
            </ul>
          </div>
        </div>
        <p className="mt-20 select-none font-display text-[18vw] font-semibold leading-[0.8] tracking-tighter text-[#FBF8F3]/[0.06] md:text-[12rem]" aria-hidden="true">
          eat · play · save
        </p>
        <div className="mt-8 flex flex-col justify-between gap-2 border-t border-white/10 pt-6 text-sm text-[#AEB5BF] sm:flex-row">
          <p>© 2026 Tiny's Vouchers by The Tiny Chef</p>
          <p>Prices in AUD. Membership renews yearly.</p>
        </div>
      </div>
    </footer>
  );
}
