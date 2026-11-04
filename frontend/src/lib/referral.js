const KEY = "gp_ref";

/** Remember a ?ref= code from a friend's invite link so sign-up and checkout can credit them. */
export const captureRef = () => {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[A-Z0-9]{4,20}$/i.test(ref)) localStorage.setItem(KEY, ref.toUpperCase());
  } catch { /* storage unavailable */ }
};

export const getRef = () => {
  try { return localStorage.getItem(KEY) || undefined; } catch { return undefined; }
};
