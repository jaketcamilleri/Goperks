const DAYS = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]];
const WEEKDAY = { open: "09:00", close: "17:00" };

export const defaultHours = () => Object.fromEntries(DAYS.map(([k], i) => [k, i < 5 ? { ...WEEKDAY } : null]));

const time = "h-10 rounded-lg border border-[#C2DEDA] bg-white px-2 text-sm disabled:opacity-40";

export const HoursEditor = ({ value, onChange }) => {
  const setDay = (k, v) => onChange({ ...value, [k]: v });
  const copyMon = () => onChange(Object.fromEntries(DAYS.map(([k], i) => [k, i < 5 ? (value.mon ? { ...value.mon } : null) : value[k]])));

  return (
    <div className="rounded-2xl border border-[#C2DEDA] bg-white p-4" data-testid="hours-editor">
      <ul className="divide-y divide-[#E3F0ED]">
        {DAYS.map(([k, label]) => {
          const d = value[k];
          return (
            <li key={k} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5" data-testid={`hours-row-${k}`}>
              <label className="flex w-32 items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={!!d} onChange={(e) => setDay(k, e.target.checked ? { ...WEEKDAY } : null)} className="h-4 w-4 accent-[#17434C]" data-testid={`hours-open-${k}`} />
                {label}
              </label>
              {d ? (
                <span className="flex items-center gap-2">
                  <input type="time" value={d.open} onChange={(e) => setDay(k, { ...d, open: e.target.value })} className={time} aria-label={`${label} opens`} data-testid={`hours-from-${k}`} required />
                  <span className="text-sm text-[#3D5E65]">to</span>
                  <input type="time" value={d.close} onChange={(e) => setDay(k, { ...d, close: e.target.value })} className={time} aria-label={`${label} closes`} data-testid={`hours-to-${k}`} required />
                </span>
              ) : <span className="text-sm text-[#3D5E65]">Closed</span>}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={copyMon} className="mt-2 text-sm font-semibold text-[#9A4024] hover:underline" data-testid="hours-copy-monday">Copy Monday to all weekdays</button>
      <p className="mt-1 text-xs text-[#3D5E65]">Closing after midnight? Just set the closing time earlier than the opening time (e.g. 6pm to 2am).</p>
    </div>
  );
};
