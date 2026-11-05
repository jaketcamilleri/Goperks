import { useEffect, useState } from "react";
import { Sun } from "lucide-react";
import { api } from "@/lib/api";
import { DealRow } from "@/components/DealRow";
import { Confetti } from "@/components/Fun";

const DOTS = [["star", "#FFD166", "right-[6%] top-6 h-7 w-7", 12], ["dot", "#FF70A6", "right-[30%] top-4 h-3 w-3"], ["squiggle", "#4CC9F0", "left-[40%] bottom-4 h-4 w-16", -6]];
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
      <div className="pop relative overflow-hidden rounded-[32px] border-[3px] border-[#17434C] bg-[#E2F9FE] px-5 pb-2 pt-4 sm:px-8">
        <Confetti items={DOTS} />
        <div className="relative">
          <DealRow id="holiday" title="School holiday picks" icon={Sun} sub={`Our favourite things to do with the kids these ${hol.name.toLowerCase()}, until ${day(hol.ends_on)}.`} deals={picks} />
        </div>
      </div>
    </div>
  );
}
