import { BizLink } from "@/lib/site";
import { Store } from "lucide-react";

const SHOP_IMG = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80";

export function BusinessCta() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24" data-testid="business-cta">
      <div className="pop grid overflow-hidden rounded-3xl border-[3px] border-[#17434C] bg-[#E2F9FE] md:grid-cols-2">
        <div className="relative min-h-[240px] border-b-[3px] border-[#17434C] md:border-b-0 md:border-r-[3px]">
          <img src={SHOP_IMG} alt="Local boutique storefront" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <div className="p-8 sm:p-12">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#9A4024]"><Store className="h-4 w-4" /> For local businesses</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Run a local business? Share a deal.</h2>
          <p className="mt-4 text-[#3D5E65] md:text-lg">Put your cafe, play centre or shop in front of local members. Apply, add your profile and submit your offer. We review it and put it live.</p>
          <BizLink to="/register" data-testid="business-cta-btn" className="pop pop-hover mt-7 inline-flex rounded-full border-2 border-[#17434C] bg-[#FFD166] px-7 py-3.5 font-bold text-[#17434C]">
            Become a partner
          </BizLink>
        </div>
      </div>
    </section>
  );
}
