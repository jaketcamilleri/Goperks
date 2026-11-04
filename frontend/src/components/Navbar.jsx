import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";

const LINKS = [
  { to: "/deals", label: "Deals" },
  { to: "/#how", label: "How it works" },
  { to: "/join", label: "Membership" },
  { to: "/business", label: "For businesses" },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const home = user?.role === "admin" ? "/admin" : user?.role === "business" ? "/business" : "/dashboard";

  const doLogout = async () => {
    await logout();
    setOpen(false);
    nav("/");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#E5DEC9]/70 bg-[#FBF8F3]/80 backdrop-blur-xl" data-testid="main-navbar">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" data-testid="nav-logo"><Logo /></Link>
        <nav className="hidden items-center gap-8 lg:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} data-testid={`nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
              className="group relative text-[15px] font-medium text-[#1E2229]">
              {l.label}
              <span className="absolute -bottom-1 left-0 h-[2px] w-full origin-left scale-x-0 bg-[#D95329] transition-transform duration-300 group-hover:scale-x-100" />
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <>
              <Link to={home} data-testid="nav-account" className="text-[15px] font-medium hover:text-[#B63F18]">My account</Link>
              <button onClick={doLogout} data-testid="nav-logout" className="rounded-full border border-[#1E2229] px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-[#1E2229] hover:text-[#FBF8F3]">Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" data-testid="nav-login" className="text-[15px] font-medium hover:text-[#B63F18]">Log in</Link>
              <Link to="/join" data-testid="nav-join" className="rounded-full bg-[#D95329] px-5 py-2.5 text-sm font-semibold text-[#FBF8F3] transition-[background-color,transform] hover:bg-[#B63F18] active:scale-95">Join for $49/yr</Link>
            </>
          )}
        </div>
        <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu" data-testid="nav-mobile-toggle">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-[#E5DEC9] lg:hidden" data-testid="nav-mobile-menu">
            <div className="flex flex-col gap-1 px-5 py-5">
              {LINKS.map((l) => (
                <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="py-2 font-display text-2xl">{l.label}</Link>
              ))}
              {user ? (
                <>
                  <Link to={home} onClick={() => setOpen(false)} className="py-2 font-display text-2xl text-[#B63F18]">My account</Link>
                  <button onClick={doLogout} className="mt-2 rounded-full border border-[#1E2229] py-3 font-semibold">Log out</button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="py-2 font-display text-2xl">Log in</Link>
                  <Link to="/join" onClick={() => setOpen(false)} className="mt-2 rounded-full bg-[#D95329] py-3 text-center font-semibold text-[#FBF8F3]">Join for $49/yr</Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
