const DAY = 86400000;
const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" });

export const isNew = (d) => !!d?.created_at && Date.now() - new Date(d.created_at).getTime() < 7 * DAY;

export const daysLeft = (d) => {
  if (!d?.ends_on) return null;
  return Math.round((new Date(`${d.ends_on}T00:00:00`) - new Date(`${todayISO()}T00:00:00`)) / DAY);
};

export const endsSoon = (d) => { const n = daysLeft(d); return n != null && n >= 0 && n <= 14; };

export const endsLabel = (d) => {
  const n = daysLeft(d);
  if (n == null) return null;
  if (n <= 0) return "Ends today";
  if (n === 1) return "Ends tomorrow";
  if (n <= 14) return `${n} days left`;
  return `Ends ${new Date(`${d.ends_on}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`;
};

export const isFavourite = (d) => (d?.rating_count || 0) >= 3 && (d?.rating_avg || 0) >= 4.5;

export const SORTS = [
  { key: "recommended", label: "Recommended" },
  { key: "rating", label: "Top rated" },
  { key: "newest", label: "Newest" },
  { key: "ending", label: "Ending soon" },
];

export const sortDeals = (list, key) => {
  const arr = [...list];
  if (key === "rating") return arr.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0) || (b.rating_count || 0) - (a.rating_count || 0));
  if (key === "newest") return arr.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  if (key === "ending") return arr.sort((a, b) => (daysLeft(a) ?? 1e6) - (daysLeft(b) ?? 1e6));
  return arr;
};
