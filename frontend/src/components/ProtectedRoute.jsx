import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function ProtectedRoute({ children, roles, loginPath = "/login" }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === null) {
    return <div className="grid min-h-[60vh] place-items-center font-mono text-sm text-[#3D5E65]" data-testid="auth-loading">Loading…</div>;
  }
  if (!user) return <Navigate to={`${loginPath}?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
