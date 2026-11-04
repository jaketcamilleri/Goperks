import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#0F3138] text-[#EAF6F3]" data-testid="site-footer">
      <div className="mx-auto max-w-7xl px-5 pb-10 pt-20 sm:px-8">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-6">
            <Logo light />
            <p className="mt-6 max-w-sm text-[#BFD9D6]">A little local club, for everyone. One yearly membership, every deal in the club.</p>
          </div>
          <div className="md:col-span-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#EE8A63]">Explore</p>
            <ul className="mt-4 space-y-2 text-[#C2DEDA]">
              <li><Link to="/deals" className="hover:text-white">All deals</Link></li>
              <li><Link to="/join" className="hover:text-white">Membership</Link></li>
              <li><Link to="/dashboard" className="hover:text-white">My card</Link></li>
            </ul>
          </div>
          <div className="md:col-span-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#EE8A63]">Partners</p>
            <ul className="mt-4 space-y-2 text-[#C2DEDA]">
              <li><Link to="/business" className="hover:text-white">List your deal</Link></li>
              <li><Link to="/login" className="hover:text-white">Partner login</Link></li>
            </ul>
          </div>
        </div>
        <p className="mt-20 select-none font-display text-[18vw] font-semibold leading-[0.8] tracking-tighter text-[#EAF6F3]/[0.06] md:text-[12rem]" aria-hidden="true">
          eat · play · save
        </p>
        <div className="mt-8 flex flex-col justify-between gap-2 border-t border-white/10 pt-6 text-sm text-[#A9C9C6] sm:flex-row">
          <p>© 2026 Go Perks</p>
          <p>Prices in AUD. Membership renews yearly.</p>
        </div>
      </div>
    </footer>
  );
}
