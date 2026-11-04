import { Link } from "react-router-dom";

const BIZ = (process.env.REACT_APP_BUSINESS_URL || "").replace(/\/$/, "");
const bizOrigin = (() => { try { return BIZ ? new URL(BIZ).origin : ""; } catch { return ""; } })();

export const IS_BIZ_HOST = window.location.hostname.startsWith("business.");
export const EXTERNAL_BIZ = !IS_BIZ_HOST && !!bizOrigin && bizOrigin !== window.location.origin;
export const BIZ_URL = BIZ;
export const MAIN_URL = IS_BIZ_HOST ? window.location.origin.replace("//business.", "//") : window.location.origin;

/** Path of a business-area page inside this app host ("" = portal home). */
export const bp = (sub = "") => (IS_BIZ_HOST ? sub || "/" : `/business${sub}`);

/** Link into the business area from anywhere (opens the business address when it lives elsewhere). */
export function BizLink({ to = "", children, ...rest }) {
  if (EXTERNAL_BIZ) return <a href={`${BIZ}${to}`} {...rest}>{children}</a>;
  return <Link to={bp(to)} {...rest}>{children}</Link>;
}

/** Link to the members site from the business host. */
export function MainLink({ to = "/", children, ...rest }) {
  if (IS_BIZ_HOST) return <a href={`${MAIN_URL}${to}`} {...rest}>{children}</a>;
  return <Link to={to} {...rest}>{children}</Link>;
}

export const assetUrl = (p) => (p ? `${IS_BIZ_HOST ? window.location.origin : process.env.REACT_APP_BACKEND_URL}${p}` : undefined);
