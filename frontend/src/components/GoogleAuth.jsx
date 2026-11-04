import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { bp, ap } from "@/lib/site";

export function startGoogleLogin(next) {
  if (next) sessionStorage.setItem("lp_next", next);
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

export function AuthCallback() {
  const location = useLocation();
  const nav = useNavigate();
  const { setUser } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const sessionId = new URLSearchParams(location.hash.slice(1)).get("session_id");
    const next = sessionStorage.getItem("lp_next");
    sessionStorage.removeItem("lp_next");
    api.post("/auth/google", { session_id: sessionId })
      .then(({ data }) => {
        setUser(data);
        const home = ["admin", "staff"].includes(data.role) ? ap("") : data.role === "business" ? bp("") : data.membership_status === "active" ? "/dashboard" : "/join";
        nav(next || home, { replace: true });
      })
      .catch((e) => {
        toast.error(formatErr(e));
        setUser(false);
        nav("/login", { replace: true });
      });
  }, [location.hash, nav, setUser]);

  return <div className="grid min-h-[60vh] place-items-center font-mono text-sm text-[#3D5E65]" data-testid="google-auth-callback">Signing you in…</div>;
}
