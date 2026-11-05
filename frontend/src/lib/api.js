import axios from "axios";
import { API_BASE } from "@/lib/site";

// Each address talks to the backend on its own origin when live, so sign-in cookies stay first-party.
const API_ORIGIN = API_BASE;

export const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  withCredentials: true,
});

let refreshing = null;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const url = original?.url || "";
    if (error.response?.status === 401 && !original._retry && !url.includes("/auth/")) {
      original._retry = true;
      try {
        refreshing = refreshing || api.post("/auth/refresh");
        await refreshing;
        refreshing = null;
        return api(original);
      } catch (e) {
        refreshing = null;
      }
    }
    return Promise.reject(error);
  }
);

export function formatErr(e) {
  const detail = e?.response?.data?.detail;
  if (detail == null) return e?.message || "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join(" ");
  return detail?.msg || String(detail);
}

/** Each category has its own bright, contrast-safe colour set: bg (tint), fg (text on tint), solid (accent), on (text on solid). */
export const CATEGORIES = [
  { key: "cafes", label: "Cafes & Brunch", img: "/images/family/cafe-girl.jpg", tone: { bg: "#FFEAD2", fg: "#612D00", solid: "#FF8531", on: "#2B1400" } },
  { key: "kids", label: "Kids Activities", img: "/images/family/playground.jpg", tone: { bg: "#FFF4CE", fg: "#543F00", solid: "#FFD166", on: "#17434C" } },
  { key: "dining", label: "Dining Out", img: "/images/family/family-dining.jpg", tone: { bg: "#FFE3EC", fg: "#750B35", solid: "#FF70A6", on: "#3D0A1F" } },
  { key: "family-fun", label: "Family Fun", img: "/images/family/kid-climbing.jpg", tone: { bg: "#E2F9FE", fg: "#034E63", solid: "#4CC9F0", on: "#0F3138" } },
  { key: "essentials", label: "Everyday Essentials", img: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1000&q=80", tone: { bg: "#EAFCDA", fg: "#224D00", solid: "#70E000", on: "#0F3138" } },
  { key: "travel", label: "Holidays & Travel", img: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1000&q=80", tone: { bg: "#F0EAFF", fg: "#311B75", solid: "#7054CB", on: "#FFFFFF" } },
];

const DEFAULT_TONE = { bg: "#EAF6F3", fg: "#17434C", solid: "#17434C", on: "#EAF6F3" };
export const catTone = (k) => CATEGORIES.find((c) => c.key === k)?.tone ?? DEFAULT_TONE;

export const catLabel = (k) => CATEGORIES.find((c) => c.key === k)?.label ?? k;
