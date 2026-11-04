import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Tag, Store, Users, CreditCard, ScanLine, LogOut, ArrowUpRight, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { ap, MainLink } from "@/lib/site";
import { Logo } from "@/components/Logo";
import AdminLogin from "@/admin/AdminLogin";

const NAV = [
  { to: "", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/deals", label: "Deals", icon: Tag, badge: "pending_deals" },
  { to: "/businesses", label: "Businesses", icon: Store, badge: "pending_businesses" },
  { to: "/members", label: "Members", icon: Users },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/check", label: "Check a code", icon: ScanLine },
];

function SideNav({ counts, onNavigate, prefix = "admin-nav" }) {
  return (
    <nav className="flex flex-col gap-1" data-testid="admin-sidenav">
      {NAV.map(({ to, label, icon: Icon, end, badge }) => (
        <NavLink key={label} to={ap(to)} end={end} onClick={onNavigate} data-testid={`${prefix}-${label.toLowerCase().replace(/\s+/g, "-")}`}
          className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${isActive ? "bg-[#EAF6F3] text-[#0F3138]" : "text-[#C2DEDA] hover:bg-white/10 hover:text-white"}`}>
          <Icon className="h-4 w-4" />
          <span className="flex-1">{label}</span>
          {badge && counts?.[badge] > 0 && <span className="rounded-md bg-[#EE8A63] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#0F3138]" data-testid={`${prefix}-badge-${badge}`}>{counts[badge]}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

function SideFooter({ user, onLogout, prefix = "admin" }) {
  return (
    <div className="space-y-2 border-t border-white/10 pt-4 text-sm">
      <MainLink to="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-[#C2DEDA] hover:bg-white/10 hover:text-white" data-testid={`${prefix}-view-site`}>
        <ArrowUpRight className="h-4 w-4" /> View members site
      </MainLink>
      <button onClick={onLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[#C2DEDA] hover:bg-white/10 hover:text-white" data-testid={`${prefix}-logout`}>
        <LogOut className="h-4 w-4" /> Log out
      </button>
      <p className="truncate px-3 pt-1 text-xs text-[#A9C9C6]" data-testid={`${prefix}-current-user`}>{user.email}</p>
    </div>
  );
}

export default function AdminShell() {
  const { user, logout } = useAuth();
  const [counts, setCounts] = useState({});
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const isAdmin = user && user.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    api.get("/admin/stats").then((r) => setCounts(r.data || {})).catch(() => {});
  }, [isAdmin, loc.pathname]);
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  if (user === null) return <div className="grid min-h-screen place-items-center bg-[#F3F8F7] font-mono text-sm text-[#3D5E65]" data-testid="admin-loading">Loading…</div>;
  if (!isAdmin) return <AdminLogin wrongRole={!!user} />;

  const doLogout = async () => { await logout(); nav(ap("")); };
  return (
    <div className="min-h-screen bg-[#F3F8F7] text-[#17434C]" data-testid="admin-shell">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col justify-between bg-[#0F3138] p-4 lg:flex">
        <div>
          <div className="mb-6 flex items-center gap-2 px-2"><Logo light /><span className="rounded bg-[#EE8A63] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#0F3138]">Admin</span></div>
          <SideNav counts={counts} />
        </div>
        <SideFooter user={user} onLogout={doLogout} />
      </aside>
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-[#0F3138] px-4 lg:hidden" data-testid="admin-mobile-bar">
        <div className="flex items-center gap-2"><Logo light /><span className="rounded bg-[#EE8A63] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#0F3138]">Admin</span></div>
        <button onClick={() => setOpen(!open)} aria-label="Menu" className="text-white" data-testid="admin-mobile-toggle">{open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
      </header>
      {open && (
        <div className="fixed inset-x-0 top-14 z-40 space-y-4 bg-[#0F3138] p-4 shadow-xl lg:hidden" data-testid="admin-mobile-menu">
          <SideNav counts={counts} onNavigate={() => setOpen(false)} prefix="admin-mnav" />
          <SideFooter user={user} onLogout={doLogout} prefix="admin-m" />
        </div>
      )}
      <main className="px-4 py-6 sm:px-6 lg:ml-60 lg:px-10 lg:py-8"><Outlet context={{ refreshCounts: () => api.get("/admin/stats").then((r) => setCounts(r.data || {})).catch(() => {}) }} /></main>
    </div>
  );
}

export const PageHead = ({ title, sub, children }) => (
  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight" data-testid="admin-page-title">{title}</h1>
      {sub && <p className="mt-1 text-sm text-[#3D5E65]">{sub}</p>}
    </div>
    {children && <div className="flex flex-wrap gap-2">{children}</div>}
  </div>
);
