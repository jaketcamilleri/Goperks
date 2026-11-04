import "@/App.css";
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
import Account from "@/pages/Account";
import BusinessRedeem from "@/pages/BusinessRedeem";
import Legal from "@/pages/Legal";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Business from "@/pages/Business";
import { ForgotPassword, ResetPassword } from "@/pages/PasswordReset";
import { AuthCallback } from "@/components/GoogleAuth";
import GiftPage from "@/pages/Gift";
import StickerPage from "@/pages/Sticker";
import RedeemGift from "@/pages/RedeemGift";
import AdminDecide from "@/pages/AdminDecide";
import AdminShell, { OwnerOnly } from "@/admin/AdminShell";
import TeamPage from "@/admin/TeamPage";
import Overview from "@/admin/Overview";
import DealsPage from "@/admin/DealsPage";
import PeoplePage from "@/admin/PeoplePage";
import { PaymentsPage, CheckPage } from "@/admin/PaymentsPage";
import { Logo } from "@/components/Logo";
import BusinessProfile from "@/pages/BusinessProfile";
import { BizNavbar } from "@/components/BizNavbar";
import { MobileTabBar } from "@/components/MobileTabBar";
import ReviewsPage from "@/admin/ReviewsPage";
import ActivityPage from "@/admin/ActivityPage";
import InvitesPage from "@/admin/InvitesPage";
import ReferralsPage from "@/admin/ReferralsPage";
import GiftsPage from "@/admin/GiftsPage";
import ProspectsPage from "@/admin/ProspectsPage";
import EmailsPage from "@/admin/EmailsPage";
import Unsubscribe from "@/pages/Unsubscribe";
import { bp, ap } from "@/lib/site";

function Layout() {
  return (
    <>
      <Navbar />
      <main className="min-h-[70vh]"><Outlet /></main>
      <Footer />
      <MobileTabBar />
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

const bizOnly = (el) => <ProtectedRoute roles={["business", "admin"]} loginPath={bp("/login")}>{el}</ProtectedRoute>;
const isPayingMember = (u) => u?.role === "member" && u?.membership_status === "active";

/** Paying members get their own home (card, saved deals, vouchers); everyone else sees the public page. */
function Home() {
  const { user } = useAuth();
  if (user === null) return <div className="min-h-[70vh]" data-testid="home-loading" />;
  return isPayingMember(user) ? <Dashboard /> : <Landing />;
}

function DashboardRoute() {
  const { user } = useAuth();
  if (isPayingMember(user)) return <Navigate to="/" replace />;
  return <ProtectedRoute><Dashboard /></ProtectedRoute>;
}

function bizRoutes() {
  return (
    <Route element={<BizLayout />}>
      <Route path={bp("")} element={<Business />} />
      <Route path={bp("/login")} element={<Auth mode="login" business />} />
      <Route path={bp("/register")} element={<Auth mode="register" business />} />
      <Route path={bp("/forgot-password")} element={<ForgotPassword loginPath={bp("/login")} />} />
      <Route path={bp("/reset-password")} element={<ResetPassword loginPath={bp("/login")} />} />
      <Route path={bp("/redeem")} element={bizOnly(<BusinessRedeem />)} />
      <Route path={bp("/profile")} element={bizOnly(<BusinessProfile />)} />
      <Route path={bp("/sticker")} element={bizOnly(<StickerPage />)} />
    </Route>
  );
}

function AdminPlain() {
  return (
    <div className="min-h-screen bg-[#F3F8F7]">
      <header className="flex h-14 items-center gap-2 bg-[#0F3138] px-5"><Logo light /><span className="rounded bg-[#EE8A63] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#0F3138]">Admin</span></header>
      <Outlet />
    </div>
  );
}

function adminRoutes() {
  return (
    <>
      <Route element={<AdminPlain />}>
        <Route path={ap("/decide")} element={<AdminDecide />} />
        <Route path={ap("/forgot-password")} element={<ForgotPassword loginPath={ap("")} />} />
        <Route path={ap("/reset-password")} element={<ResetPassword loginPath={ap("")} />} />
      </Route>
      <Route element={<AdminShell />}>
        <Route path={ap("")} element={<Overview />} />
        <Route path={ap("/deals")} element={<DealsPage />} />
        <Route path={ap("/businesses")} element={<PeoplePage role="business" />} />
        <Route path={ap("/members")} element={<OwnerOnly><PeoplePage role="member" /></OwnerOnly>} />
        <Route path={ap("/payments")} element={<OwnerOnly><PaymentsPage /></OwnerOnly>} />
        <Route path={ap("/team")} element={<OwnerOnly><TeamPage /></OwnerOnly>} />
        <Route path={ap("/check")} element={<CheckPage />} />
        <Route path={ap("/reviews")} element={<ReviewsPage />} />
        <Route path={ap("/activity")} element={<OwnerOnly><ActivityPage /></OwnerOnly>} />
        <Route path={ap("/invites")} element={<OwnerOnly><InvitesPage /></OwnerOnly>} />
        <Route path={ap("/referrals")} element={<OwnerOnly><ReferralsPage /></OwnerOnly>} />
        <Route path={ap("/gifts")} element={<OwnerOnly><GiftsPage /></OwnerOnly>} />
        <Route path={ap("/prospects")} element={<OwnerOnly><ProspectsPage /></OwnerOnly>} />
        <Route path={ap("/emails")} element={<OwnerOnly><EmailsPage /></OwnerOnly>} />
      </Route>
    </>
  );
}

function AppRoutes() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
        <Routes>
          {bizRoutes()}
          {adminRoutes()}
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
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
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/dashboard" element={<DashboardRoute />} />
            <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
            <Route path="/terms" element={<Legal doc="terms" />} />
            <Route path="/privacy" element={<Legal doc="privacy" />} />
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
