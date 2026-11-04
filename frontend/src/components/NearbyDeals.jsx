import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { LocateFixed, MapPin } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useMyLocation, sortNearby } from "@/lib/nearby";
import { DealCard } from "@/components/DealCard";
import { SuburbPicker } from "@/components/SuburbPicker";

const chip = "inline-flex items-center gap-1.5 rounded-full border border-[#17434C] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[#17434C] hover:text-[#EAF6F3] disabled:opacity-50";

function SetSuburb({ onSaved }) {
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const save = async ({ suburb, postcode }) => {
    if (!suburb || !postcode) return;
    setBusy(true);
    try {
      const { data } = await api.patch("/me", { name: user.name, email: user.email, phone: user.phone || null, suburb, postcode });
      setUser(data); onSaved(); toast.success(`Showing deals near ${data.suburb}`);
    } catch (e) { toast.error(formatErr(e)); } finally { setBusy(false); }
  };
  return (
    <div className="max-w-md" data-testid="nearby-set-suburb">
      <p className="text-sm text-[#3D5E65]">Tell us your suburb and we'll show the deals closest to you.</p>
      <SuburbPicker id="home-suburb" onChange={save} className="mt-2" testid="nearby-suburb-picker" placeholder={busy ? "Saving…" : "Your suburb or postcode"} />
    </div>
  );
}

/** "Deals near you" on the member home: sorted from the member's suburb, or their live location. */
export function NearbyDeals() {
  const { user } = useAuth();
  const [deals, setDeals] = useState(null);
  const [home, setHome] = useState(null);
  const [tick, setTick] = useState(0);
  const { me, state, locate, clear } = useMyLocation();
  useEffect(() => { api.get("/deals").then((r) => setDeals(Array.isArray(r.data) ? r.data : [])).catch(() => setDeals([])); }, []);
  useEffect(() => { api.get("/me/home-area").then((r) => setHome(r.data?.lat != null ? r.data : null)).catch(() => setHome(null)); }, [tick, user?.suburb]);

  const origin = me || (home ? { lat: home.lat, lng: home.lng } : null);
  const list = useMemo(() => (origin && deals ? sortNearby(deals, origin).filter((d) => d.distance != null).slice(0, 6) : []), [deals, origin]);
  if (!deals?.length) return null;

  return (
    <section className="mt-14" data-testid="nearby-deals">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-semibold">Deals near you</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[#3D5E65]" data-testid="nearby-origin">
            <MapPin className="h-4 w-4" />{me ? "Closest to where you are now" : home ? `Closest to ${home.suburb}` : "Set your suburb to see what's close"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={me ? clear : locate} disabled={state === "locating"} className={chip} data-testid="nearby-locate-btn">
            <LocateFixed className="h-4 w-4" />{state === "locating" ? "Finding you…" : me ? (home ? `Use ${home.suburb}` : "Stop using location") : "Use my location"}
          </button>
          <Link to="/deals?near=1" className={chip} data-testid="nearby-see-all">See all nearby</Link>
        </div>
      </div>
      {state === "denied" && <p className="mt-3 text-sm text-[#9A4024]" data-testid="nearby-location-denied">Location is blocked in your browser. We'll use your suburb instead.</p>}
      {!origin ? <div className="mt-5"><SetSuburb onSaved={() => setTick((n) => n + 1)} /></div> : list.length ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="nearby-list">
          {list.map((d) => <DealCard key={d.id} deal={d} compact />)}
        </div>
      ) : <p className="mt-4 text-sm text-[#3D5E65]" data-testid="nearby-empty">No deals with a location yet. Check back soon.</p>}
    </section>
  );
}
