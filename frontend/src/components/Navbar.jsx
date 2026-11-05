import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { RainbowBar } from "@/components/Fun";
import { useAuth } from "@/context/AuthContext";
import { BizLink, AdminLink, bp } from "@/lib/site";

const LINKS = [
  { to: "/deals", label: "Deals" },
  { to: "/#how", label: "How it works" },
  { to: "/join", label: "Membership" },
  { to: "/gift", label: "Gift" },
];
const MEMBER_LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/deals", label: "Deals" },
  { to: "/gift", label: "Gift" },
];
const linkCls = "group relative text-[15px] font-medium text-[#17434C]";
const underline = <span className="absolute -bottom-1 left-0 h-[3px] w-full origin-left scale-x-0 rounded-full bg-[#FFD166] transition-transform duration-300 group-hover:scale-x-100" />;

export function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const isBiz = user?.role === "business";
  const isAdmin = user?.role === "admin" || user?.role === "staff";
  const home = "/dashboard";
  const paying = user?.role === "member" && user?.membership_status === "active";
  const links = paying ? MEMBER_LINKS : LINKS;
  const accountTo = paying ? "/account" : home;

  const doLogout = async () => {
    await logout();
    setOpen(false);
    nav("/");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#C2DEDA]/70 bg-[#FFFDF7]/85 backdrop-blur-xl" data-testid="main-navbar">
      <RainbowBar className="h-1" />
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" data-testid="nav-logo"><Logo /></Link>
        <nav className="hidden items-center gap-8 lg:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} data-testid={`nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`} className={linkCls}>
              {l.label}
              {underline}
            </NavLink>
          ))}
          {!paying && <BizLink data-testid="nav-for-businesses" className={linkCls}>For businesses{underline}</BizLink>}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <>
              {isBiz ? <><Link to={bp("/redeem")} data-testid="nav-redeem" className="text-[15px] font-medium hover:text-[#9A4024]">Redeem</Link><Link to={bp("")} data-testid="nav-account" className="text-[15px] font-medium hover:text-[#9A4024]">My account</Link></>
                : isAdmin ? <AdminLink data-testid="nav-account" className="text-[15px] font-medium hover:text-[#9A4024]">Admin</AdminLink>
                : <Link to={accountTo} data-testid="nav-account" className="text-[15px] font-medium hover:text-[#9A4024]">My account</Link>}
              <button onClick={doLogout} data-testid="nav-logout" className="rounded-full border-2 border-[#17434C] bg-white px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-[#4CC9F0]">Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" data-testid="nav-login" className="text-[15px] font-medium hover:text-[#9A4024]">Log in</Link>
              <Link to="/join" data-testid="nav-join" className="pop-sm pop-hover rounded-full border-2 border-[#17434C] bg-[#B9512E] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#9A4024]">Join for $49/yr</Link>
            </>
          )}
        </div>
        <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu" data-testid="nav-mobile-toggle">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-[#C2DEDA] lg:hidden" data-testid="nav-mobile-menu">
            <div className="flex flex-col gap-1 px-5 py-5">
              {links.map((l) => (
                <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="py-2 font-display text-2xl">{l.label}</Link>
              ))}
              {!paying && <BizLink onClick={() => setOpen(false)} className="py-2 font-display text-2xl" data-testid="nav-mobile-for-businesses">For businesses</BizLink>}
              {user ? (
                <>
                  {isBiz && <Link to={bp("/redeem")} onClick={() => setOpen(false)} className="py-2 font-display text-2xl" data-testid="nav-mobile-redeem">Redeem a deal</Link>}
                  {isAdmin ? <AdminLink onClick={() => setOpen(false)} className="py-2 font-display text-2xl text-[#9A4024]">Admin</AdminLink>
                    : <Link to={isBiz ? bp("") : accountTo} onClick={() => setOpen(false)} className="py-2 font-display text-2xl text-[#9A4024]" data-testid="nav-mobile-account">My account</Link>}
                  <button onClick={doLogout} className="mt-2 rounded-full border border-[#17434C] py-3 font-semibold">Log out</button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="py-2 font-display text-2xl">Log in</Link>
                  <Link to="/join" onClick={() => setOpen(false)} className="pop-sm mt-2 rounded-full border-2 border-[#17434C] bg-[#B9512E] py-3 text-center font-bold text-white">Join for $49/yr</Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
