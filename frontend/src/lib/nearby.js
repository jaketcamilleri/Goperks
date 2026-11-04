import { useState } from "react";

const toRad = (d) => (d * Math.PI) / 180;
export const distanceKm = (a, b) => {
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};
export const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000 / 50) * 50 || 50} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`);

/** Adds `distance` to each deal and sorts: open now first, then closest. Deals without a location go last. */
export const sortNearby = (deals, me) => deals
  .map((d) => ({ ...d, distance: me && d.lat != null && d.lng != null ? distanceKm(me, d) : null }))
  .sort((a, b) => (b.open_now === true) - (a.open_now === true) || (a.distance ?? 1e9) - (b.distance ?? 1e9));

export function useMyLocation() {
  const [me, setMe] = useState(null);
  const [state, setState] = useState("idle");
  const locate = () => {
    if (!navigator.geolocation) { setState("unsupported"); return; }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => { setMe({ lat: p.coords.latitude, lng: p.coords.longitude }); setState("on"); },
      (e) => setState(e.code === 1 ? "denied" : "error"),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  };
  const clear = () => { setMe(null); setState("idle"); };
  return { me, state, locate, clear };
}
