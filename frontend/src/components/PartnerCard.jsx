import { MapPin, Phone, Globe, Instagram, Clock } from "lucide-react";
import { assetUrl } from "@/lib/site";

function Row({ icon: Icon, children, id }) {
  return (
    <li className="flex gap-3" data-testid={`partner-${id}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#9A4024]" />
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

export const PartnerCard = ({ p }) => {
  if (!p) return null;
  const site = p.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.business_name, p.address, p.suburb].filter(Boolean).join(", "))}`;
  return (
    <section className="mt-6 rounded-[24px] border border-[#C2DEDA] bg-white p-6" data-testid="deal-partner-card">
      <div className="flex items-center gap-4">
        {p.logo_url && <img src={assetUrl(p.logo_url)} alt={`${p.business_name} logo`} className="h-14 w-14 shrink-0 rounded-2xl border border-[#C2DEDA] object-contain" data-testid="partner-logo" />}
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-widest text-[#9A4024]">About the business</p>
          <p className="truncate font-display text-xl font-semibold">{p.business_name}</p>
        </div>
      </div>
      {p.about && <p className="mt-4 text-sm leading-relaxed text-[#3D5E65]" data-testid="partner-about">{p.about}</p>}
      <ul className="mt-5 space-y-3 text-sm text-[#17434C]">
        {p.address && <Row icon={MapPin} id="address"><a href={maps} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{p.address}{p.suburb ? `, ${p.suburb}` : ""}</a></Row>}
        {p.opening_hours && <Row icon={Clock} id="hours"><span className="whitespace-pre-line">{p.opening_hours}</span></Row>}
        {p.phone && <Row icon={Phone} id="phone"><a href={`tel:${p.phone.replace(/\s+/g, "")}`} className="hover:underline">{p.phone}</a></Row>}
        {site && <Row icon={Globe} id="website"><a href={p.website} target="_blank" rel="noreferrer" className="hover:underline">{site}</a></Row>}
        {p.instagram && <Row icon={Instagram} id="instagram"><a href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noreferrer" className="hover:underline">@{p.instagram}</a></Row>}
      </ul>
    </section>
  );
};
