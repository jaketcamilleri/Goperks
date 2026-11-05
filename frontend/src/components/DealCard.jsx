import { Link } from "react-router-dom";
import { MapPin, Sparkles, Timer, Award } from "lucide-react";
import { catLabel } from "@/lib/api";
import { HeartButton } from "@/components/HeartButton";
import { OpenNowBadge } from "@/components/OpenNowBadge";
import { RatingChip } from "@/components/Stars";
import { fmtKm } from "@/lib/nearby";
import { isNew, endsSoon, endsLabel, isFavourite } from "@/lib/deals";

function Flag({ deal }) {
  if (isFavourite(deal)) return <span className="inline-flex items-center gap-1 rounded-md bg-[#E8F2EA] px-2 py-0.5 text-[11px] font-bold text-[#2F5A3A]" data-testid={`deal-favourite-${deal.id}`}><Award className="h-3 w-3" /> Member favourite</span>;
  if (endsSoon(deal)) return <span className="inline-flex items-center gap-1 rounded-md bg-[#FDF0EC] px-2 py-0.5 text-[11px] font-bold text-[#9A4024]" data-testid={`deal-ending-${deal.id}`}><Timer className="h-3 w-3" /> {endsLabel(deal)}</span>;
  if (isNew(deal)) return <span className="inline-flex items-center gap-1 rounded-md bg-[#FEF4DC] px-2 py-0.5 text-[11px] font-bold text-[#7A5310]" data-testid={`deal-new-${deal.id}`}><Sparkles className="h-3 w-3" /> New</span>;
  return null;
}

export function DealCard({ deal, compact = false }) {
  return (
    <div className="relative h-full" data-testid={`deal-card-wrap-${deal.id}`}>
      <HeartButton dealId={deal.id} className="absolute right-3 top-3 z-10" />
      <Link to={`/deals/${deal.id}`} data-testid={`deal-card-${deal.id}`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#D3ECE7] bg-white transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#C2DEDA] hover:shadow-[0_12px_30px_-12px_rgba(23,67,76,0.25)]">
        <div className={`relative overflow-hidden bg-[#D3ECE7] ${compact ? "aspect-[16/10]" : "aspect-[16/10]"}`}>
          {deal.image_url
            ? <img src={deal.image_url} alt={deal.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
            : <div className="grid h-full w-full place-items-center bg-[#17434C] p-6 text-center font-display text-2xl font-semibold text-[#EAF6F3]" data-testid={`deal-card-noimg-${deal.id}`}>{deal.business_name}</div>}
          <span className="absolute left-3 top-3 rounded-full bg-[#B9512E] px-3 py-1 text-sm font-bold text-white shadow-sm" data-testid={`deal-offer-${deal.id}`}>{deal.discount_label}</span>
          {deal.open_now && <OpenNowBadge className="absolute bottom-3 left-3 shadow" testId={`open-now-${deal.id}`} />}
        </div>
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#9A4024]">{catLabel(deal.category)}</span>
            <Flag deal={deal} />
          </div>
          <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-[#17434C] group-hover:text-[#9A4024] sm:text-xl">{deal.title}</h3>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-[#3D5E65]">
            <span className="font-semibold text-[#17434C]">{deal.business_name}</span>
            {deal.suburb && <><span aria-hidden="true">·</span><MapPin className="h-3.5 w-3.5" />{deal.suburb}</>}
            {deal.distance != null && <span className="rounded-full bg-[#EAF6F3] px-2 py-0.5 font-mono text-[11px] font-bold text-[#17434C]" data-testid={`deal-distance-${deal.id}`}>{fmtKm(deal.distance)}</span>}
          </p>
          <div className="mt-auto pt-3"><RatingChip deal={deal} testId={`deal-rating-${deal.id}`} /></div>
        </div>
      </Link>
    </div>
  );
}
