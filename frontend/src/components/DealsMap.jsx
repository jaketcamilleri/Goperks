import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Link } from "react-router-dom";
import "leaflet/dist/leaflet.css";

const pin = (label) =>
  L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center">
      <span style="background:#D95329;color:#FBF8F3;font:700 12px 'Bricolage Grotesque',sans-serif;padding:6px 10px;border-radius:999px;white-space:nowrap;box-shadow:0 8px 20px -6px rgba(30,34,41,.5)">${label.replace(/</g, "&lt;")}</span>
      <span style="width:2px;height:10px;background:#D95329"></span></div>`,
  });

export function DealsMap({ deals }) {
  const points = (Array.isArray(deals) ? deals : []).filter((d) => typeof d.lat === "number" && typeof d.lng === "number");
  const center = points.length ? [points.reduce((a, d) => a + d.lat, 0) / points.length, points.reduce((a, d) => a + d.lng, 0) / points.length] : [-37.8136, 144.9631];

  return (
    <div className="relative z-0 h-[460px] overflow-hidden rounded-[28px] border border-[#E0D7C3] sm:h-[560px]" data-lenis-prevent data-testid="deals-map">
      <MapContainer key={points.map((p) => p.id).join(",")} center={center} zoom={points.length > 1 ? 10 : 12} scrollWheelZoom className="h-full w-full">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {points.map((d) => (
          <Marker key={d.id} position={[d.lat, d.lng]} icon={pin(d.discount_label)}>
            <Popup>
              <div className="w-48">
                <img src={d.image_url} alt="" className="mb-2 h-24 w-full rounded-lg object-cover" />
                <p className="font-display text-base font-semibold leading-tight">{d.title}</p>
                <p className="mt-1 text-xs text-[#525B68]">{d.business_name} · {d.suburb}</p>
                <Link to={`/deals/${d.id}`} className="mt-2 inline-block text-xs font-bold text-[#B63F18]" data-testid={`map-deal-link-${d.id}`}>View deal →</Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {points.length === 0 && (
        <p className="absolute inset-x-0 top-4 z-[500] mx-auto w-fit rounded-full bg-white px-4 py-2 text-sm shadow">No mapped deals for this filter</p>
      )}
    </div>
  );
}
