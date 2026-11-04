import { NavLink } from "react-router-dom";
import { Home, Compass, LocateFixed, CreditCard, UserPlus, LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/** Phone-only bottom navigation for members and visitors. */
export function MobileTabBar() {
  const { user } = useAuth();
  if (user && user.role !== "member") return null;
  const tabs = [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/deals", label: "Deals", icon: Compass, end: true },
    { to: "/deals?near=1", label: "Near me", icon: LocateFixed },
    user ? { to: "/dashboard", label: "My card", icon: CreditCard } : { to: "/join", label: "Join", icon: UserPlus },
    ...(user ? [] : [{ to: "/login", label: "Log in", icon: LogIn }]),
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#C2DEDA] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" data-testid="mobile-bottom-tab-bar">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <li key={label}>
            <NavLink to={to} end={end} data-testid={`tab-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${isActive && !to.includes("?") ? "text-[#B9512E]" : "text-[#3D5E65]"}`}>
              <Icon className="h-5 w-5" />{label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
