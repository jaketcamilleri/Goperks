import { Logo } from "@/components/Logo";
import { RainbowBar } from "@/components/Fun";

const WORDS = [["eat", "#FF8531"], ["play", "#FFD166"], ["save", "#4CC9F0"]];
import { BizLink, MainLink } from "@/lib/site";

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#0F3138] pb-16 text-[#EAF6F3] md:pb-0" data-testid="site-footer">
      <RainbowBar className="h-2" />
      <div className="mx-auto max-w-7xl px-5 pb-10 pt-20 sm:px-8">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-6">
            <Logo light />
            <p className="mt-6 max-w-sm text-[#BFD9D6]">The local family club. One yearly membership, deals for the whole crew at cafes, play centres, restaurants and days out.</p>
          </div>
          <div className="md:col-span-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#EE8A63]">Explore</p>
            <ul className="mt-4 space-y-2 text-[#C2DEDA]">
              <li><MainLink to="/deals" className="hover:text-white">All deals</MainLink></li>
              <li><MainLink to="/join" className="hover:text-white">Membership</MainLink></li>
              <li><MainLink to="/dashboard" className="hover:text-white">My card</MainLink></li>
            </ul>
          </div>
          <div className="md:col-span-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#EE8A63]">Partners</p>
            <ul className="mt-4 space-y-2 text-[#C2DEDA]">
              <li><BizLink to="/register" className="hover:text-white" data-testid="footer-partner-apply">List your deal</BizLink></li>
              <li><BizLink to="/login" className="hover:text-white" data-testid="footer-partner-login">Partner login</BizLink></li>
            </ul>
          </div>
        </div>
        <p className="mt-20 select-none font-display text-[16vw] font-semibold leading-[0.8] tracking-tighter opacity-25 md:text-[11rem]" aria-hidden="true">
          {WORDS.map(([w, c], i) => <span key={w} style={{ color: c }}>{w}{i < 2 ? " · " : ""}</span>)}
        </p>
        <div className="mt-8 flex flex-col justify-between gap-2 border-t border-white/10 pt-6 text-sm text-[#A9C9C6] sm:flex-row">
          <p>© 2026 Go Perks</p>
          <p className="flex flex-wrap gap-x-5 gap-y-1">
            <MainLink to="/terms" className="hover:text-white" data-testid="footer-terms">Terms and conditions</MainLink>
            <MainLink to="/privacy" className="hover:text-white" data-testid="footer-privacy">Privacy policy</MainLink>
            <span>Prices in AUD incl. GST.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
