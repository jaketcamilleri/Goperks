import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export const STATUS_COLOR = { new: "#17434C", contacted: "#C98A12", interested: "#2F7A45", joined: "#B9512E", not_interested: "#8A9A9D" };

const dot = (color, exact) => L.divIcon({
  className: "", iconSize: [18, 18], iconAnchor: [9, 9],
  html: `<span style="display:block;width:18px;height:18px;border-radius:999px;background:${exact ? color : "#fff"};border:3px ${exact ? "solid #fff" : `dashed ${color}`};box-shadow:0 4px 12px -2px rgba(23,67,76,.55)"></span>`,
});

/** Prospects on a map of Melbourne's west. Dashed pins sit at the suburb centre because no street address is known. */
export function ProspectsMap({ prospects, labels, onOpen }) {
  const points = prospects.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
  const center = points.length ? [points.reduce((a, p) => a + p.lat, 0) / points.length, points.reduce((a, p) => a + p.lng, 0) / points.length] : [-37.82, 144.85];

  return (
    <div data-testid="prospects-map">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#3D5E65]" data-testid="prospects-map-legend">
        {Object.entries(STATUS_COLOR).map(([k, c]) => <span key={k} className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ background: c }} />{labels[k]}</span>)}
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-dashed border-[#17434C]" />Suburb only, no street address yet</span>
      </div>
      <div className="relative z-0 h-[520px] overflow-hidden rounded-2xl border border-[#D7E7E4] sm:h-[620px]" data-lenis-prevent>
        <MapContainer center={center} zoom={11} scrollWheelZoom className="h-full w-full">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {points.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={dot(STATUS_COLOR[p.status] || STATUS_COLOR.new, p.located === "exact")}>
              <Popup>
                <div className="w-52" data-testid={`map-prospect-${p.id}`}>
                  <p className="font-display text-base font-semibold leading-tight">{p.business_name}</p>
                  <p className="mt-1 text-xs text-[#3D5E65]">{[p.address, `${p.suburb} ${p.postcode || ""}`.trim()].filter(Boolean).join(", ")}</p>
                  <p className="mt-1 text-xs"><b style={{ color: STATUS_COLOR[p.status] }}>{labels[p.status]}</b>{p.email ? ` · ${p.email}` : ""}</p>
                  <div className="mt-2 flex gap-3 text-xs font-bold">
                    <button onClick={() => onOpen(p)} className="text-[#9A4024]" data-testid={`map-open-${p.id}`}>Open</button>
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([p.business_name, p.address, p.suburb, "VIC"].filter(Boolean).join(", "))}`}
                      target="_blank" rel="noreferrer" className="text-[#17434C]">Directions</a>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <p className="mt-2 text-xs text-[#3D5E65]">{points.length} of {prospects.length} shown. Add a street address to a dashed pin to place it exactly.</p>
    </div>
  );
}
