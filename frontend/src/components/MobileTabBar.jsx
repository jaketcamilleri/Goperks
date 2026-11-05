import { NavLink } from "react-router-dom";
import { Home, Compass, LocateFixed, CreditCard, UserPlus, LogIn, UserCog } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const TAB_COLOURS = ["#FFD166", "#4CC9F0", "#70E000", "#FF70A6", "#FFEAD2"];

/** Phone-only bottom navigation for members and visitors. */
export function MobileTabBar() {
  const { user } = useAuth();
  if (user && user.role !== "member") return null;
  const paying = user?.membership_status === "active";
  const tabs = paying ? [
    { to: "/", label: "My card", icon: CreditCard, end: true },
    { to: "/deals", label: "Deals", icon: Compass, end: true },
    { to: "/deals?near=1", label: "Near me", icon: LocateFixed },
    { to: "/account", label: "Account", icon: UserCog },
  ] : [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/deals", label: "Deals", icon: Compass, end: true },
    { to: "/deals?near=1", label: "Near me", icon: LocateFixed },
    user ? { to: "/dashboard", label: "My card", icon: CreditCard } : { to: "/join", label: "Join", icon: UserPlus },
    ...(user ? [] : [{ to: "/login", label: "Log in", icon: LogIn }]),
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-[#17434C] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" data-testid="mobile-bottom-tab-bar">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map(({ to, label, icon: Icon, end }, i) => (
          <li key={label}>
            <NavLink to={to} end={end} data-testid={`tab-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold transition-colors ${isActive && !to.includes("?") ? "text-[#17434C]" : "text-[#3D5E65]"}`}>
              {({ isActive }) => (
                <>
                  <span className="grid h-7 w-11 place-items-center rounded-full transition-colors" style={{ background: isActive && !to.includes("?") ? TAB_COLOURS[i % 5] : "transparent" }}><Icon className="h-5 w-5" /></span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
