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
import Business from "@/pages/Business";
import Admin from "@/pages/Admin";
import { ForgotPassword, ResetPassword } from "@/pages/PasswordReset";
import { AuthCallback } from "@/components/GoogleAuth";
import GiftPage from "@/pages/Gift";
import StickerPage from "@/pages/Sticker";
import RedeemGift from "@/pages/RedeemGift";

function Layout() {
  return (
    <>
      <Navbar />
      <main className="min-h-[70vh]"><Outlet /></main>
      <Footer />
    </>
  );
}

function AppRoutes() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
        <Routes>
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
            <Route path="/business" element={<Business />} />
            <Route path="/business/sticker" element={<ProtectedRoute roles={["business", "admin"]}><StickerPage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
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
