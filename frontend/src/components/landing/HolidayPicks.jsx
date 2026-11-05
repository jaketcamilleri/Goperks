import { useEffect, useState } from "react";
import { Sun } from "lucide-react";
import { api } from "@/lib/api";
import { DealRow } from "@/components/DealRow";

const day = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long" });

/** Admin-picked deals, shown only while Victorian school holidays are on. */
export function HolidayPicks({ deals }) {
  const [hol, setHol] = useState(null);
  useEffect(() => {
    let live = true;
    api.get("/school-holidays").then((r) => { if (live) setHol(r.data?.active ? r.data : null); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const picks = (Array.isArray(deals) ? deals : []).filter((d) => d.holiday_pick);
  if (!hol || picks.length === 0) return null;
  return (
    <div className="mx-auto max-w-7xl px-5 pt-6 sm:px-8" data-testid="holiday-picks">
      <div className="rounded-[32px] bg-[#D3ECE7] px-5 pb-2 pt-4 sm:px-8">
        <div>
          <DealRow id="holiday" title="School holiday picks" icon={Sun} sub={`Our favourite things to do with the kids these ${hol.name.toLowerCase()}, until ${day(hol.ends_on)}.`} deals={picks} />
        </div>
      </div>
    </div>
  );
}
