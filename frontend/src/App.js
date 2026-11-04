import "@/App.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Outlet, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "@/pages/Landing";
import Deals from "@/pages/Deals";
import DealDetail from "@/pages/DealDetail";
import Join from "@/pages/Join";
import { PaymentSuccess, PaymentCancel } from "@/pages/Payment";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Business from "@/pages/Business";
import Admin from "@/pages/Admin";
import { ForgotPassword, ResetPassword } from "@/pages/PasswordReset";
import { AuthCallback } from "@/components/GoogleAuth";
import GiftPage from "@/pages/Gift";
import StickerPage from "@/pages/Sticker";
import RedeemGift from "@/pages/RedeemGift";
import AdminDecide from "@/pages/AdminDecide";
import BusinessProfile from "@/pages/BusinessProfile";
import { BizNavbar } from "@/components/BizNavbar";
import { IS_BIZ_HOST, EXTERNAL_BIZ, BIZ_URL, MAIN_URL, bp } from "@/lib/site";

function Layout() {
  return (
    <>
      <Navbar />
      <main className="min-h-[70vh]"><Outlet /></main>
      <Footer />
    </>
  );
}

function BizLayout() {
  return (
    <>
      <BizNavbar />
      <main className="min-h-[70vh]"><Outlet /></main>
      <Footer />
    </>
  );
}

function GoElsewhere({ base, strip = "" }) {
  const loc = useLocation();
  useEffect(() => {
    window.location.replace(`${base}${loc.pathname.slice(strip.length)}${loc.search}`);
  }, [base, strip, loc]);
  return <div className="grid min-h-[60vh] place-items-center font-mono text-sm text-[#3D5E65]" data-testid="redirecting">Taking you there…</div>;
}

const bizOnly = (el) => <ProtectedRoute roles={["business", "admin"]} loginPath={bp("/login")}>{el}</ProtectedRoute>;

function bizRoutes() {
  return (
    <Route element={<BizLayout />}>
      <Route path={bp("")} element={<Business />} />
      <Route path={bp("/login")} element={<Auth mode="login" business />} />
      <Route path={bp("/register")} element={<Auth mode="register" business />} />
      <Route path={bp("/forgot-password")} element={<ForgotPassword business />} />
      <Route path={bp("/reset-password")} element={<ResetPassword business />} />
      <Route path={bp("/profile")} element={bizOnly(<BusinessProfile />)} />
      <Route path={bp("/sticker")} element={bizOnly(<StickerPage />)} />
    </Route>
  );
}

function AppRoutes() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  if (IS_BIZ_HOST) {
    return (
      <Routes>
        {bizRoutes()}
        <Route path="*" element={<GoElsewhere base={MAIN_URL} />} />
      </Routes>
    );
  }
  return (
        <Routes>
          {EXTERNAL_BIZ ? <Route path="/business/*" element={<GoElsewhere base={BIZ_URL} strip="/business" />} /> : bizRoutes()}
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/deals" element={<Deals />} />
            <Route path="/deals/:id" element={<DealDetail />} />
            <Route path="/join" element={<Join />} />
            <Route path="/gift" element={<GiftPage />} />
            <Route path="/redeem-gift" element={<RedeemGift />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/cancel" element={<PaymentCancel />} />
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/register" element={<Auth mode="register" />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/admin/decide" element={<AdminDecide />} />
            <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><Admin /></ProtectedRoute>} />
          </Route>
        </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FavoritesProvider>
        <SmoothScroll />
        <Toaster position="top-center" richColors />
        <AppRoutes />
        </FavoritesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
