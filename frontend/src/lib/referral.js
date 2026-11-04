const KEY = "gp_ref";
export const REF_PATTERN = /^[A-Z0-9]{4,20}$/i;

/** Remember a friend's referral code so sign-up (email or Google) and checkout can credit them. */
export const setRef = (code) => {
  try {
    if (code && REF_PATTERN.test(code)) localStorage.setItem(KEY, code.toUpperCase());
    else localStorage.removeItem(KEY);
  } catch { /* storage unavailable */ }
};

/** Pick up ?ref= from a friend's invite link. */
export const captureRef = () => {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && REF_PATTERN.test(ref)) setRef(ref);
  } catch { /* no window */ }
};

export const getRef = () => {
  try { return localStorage.getItem(KEY) || undefined; } catch { return undefined; }
};
