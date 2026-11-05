import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { RainbowBar } from "@/components/Fun";
import { useAuth } from "@/context/AuthContext";
import { bp, MainLink } from "@/lib/site";

const ghost = "rounded-full border-2 border-[#17434C] bg-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-[#4CC9F0] sm:px-5 sm:py-2.5";
const solid = "pop-sm pop-hover rounded-full border-2 border-[#17434C] bg-[#B9512E] px-4 py-2 text-sm font-bold text-white hover:bg-[#9A4024] sm:px-5 sm:py-2.5";

export function BizNavbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const doLogout = async () => { await logout(); nav(bp("/login")); };
  const canEdit = user?.role === "business" && user?.business_status === "approved";

  return (
    <header className="sticky top-0 z-50 border-b border-[#C2DEDA]/70 bg-[#FFFDF7]/90 backdrop-blur-xl" data-testid="biz-navbar">
      <RainbowBar className="h-1" />
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-5 sm:px-8">
        <Link to={bp("")} className="flex min-w-0 items-center gap-2 sm:gap-3" data-testid="biz-nav-logo">
          <Logo />
          <span className="rounded-full bg-[#7054CB] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-white sm:text-[11px]">Partners</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <MainLink to="/" className="hidden items-center gap-1 text-[15px] font-medium hover:text-[#9A4024] md:inline-flex" data-testid="biz-nav-members-site">
            Members site <ArrowUpRight className="h-4 w-4" />
          </MainLink>
          {user ? (
            <>
              {canEdit && <Link to={bp("/profile")} className="hidden text-[15px] font-medium hover:text-[#9A4024] sm:inline" data-testid="biz-nav-profile">Profile</Link>}
              <button onClick={doLogout} className={ghost} data-testid="biz-nav-logout">Log out</button>
            </>
          ) : (
            <>
              <Link to={bp("/login")} className={ghost} data-testid="biz-nav-login">Log in</Link>
              <Link to={bp("/register")} className={`${solid} hidden sm:inline-flex`} data-testid="biz-nav-register">Become a partner</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
