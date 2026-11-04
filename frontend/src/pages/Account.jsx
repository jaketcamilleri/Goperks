import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { DetailsForm, PasswordForm } from "@/components/account/AccountForms";
import { MembershipPanel, GiftsPanel } from "@/components/account/AccountPanels";
import { ReferralCard } from "@/components/ReferralCard";

/** Manage account: details, password, membership and payments, referrals and gift codes. */
export default function Account() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-4xl px-5 pb-28 pt-8 sm:px-8 lg:pt-12" data-testid="account-page">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#9A4024]" data-testid="account-back-home"><ArrowLeft className="h-4 w-4" /> Back to my home</Link>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">My account</h1>
      <p className="mt-2 text-[#3D5E65]">{user?.email}</p>
      <div className="mt-8 space-y-6">
        <DetailsForm />
        <MembershipPanel />
        {user?.role === "member" && <ReferralCard />}
        <GiftsPanel />
        <PasswordForm />
      </div>
    </div>
  );
}
