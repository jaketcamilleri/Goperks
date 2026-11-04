import { Link } from "react-router-dom";

const BIZ = (process.env.REACT_APP_BUSINESS_URL || "").replace(/\/$/, "");
const ADM = (process.env.REACT_APP_ADMIN_URL || "").replace(/\/$/, "");
const originOf = (u) => { try { return u ? new URL(u).origin : ""; } catch { return ""; } };
const bizOrigin = originOf(BIZ);
const admOrigin = originOf(ADM);

export const IS_BIZ_HOST = window.location.hostname.startsWith("business.");
export const IS_ADMIN_HOST = window.location.hostname.startsWith("admin.");
export const EXTERNAL_BIZ = !IS_BIZ_HOST && !!bizOrigin && bizOrigin !== window.location.origin;
export const EXTERNAL_ADMIN = !IS_ADMIN_HOST && !!admOrigin && admOrigin !== window.location.origin;
export const BIZ_URL = BIZ;
export const ADMIN_URL = ADM;
export const MAIN_URL = IS_BIZ_HOST || IS_ADMIN_HOST ? window.location.origin.replace(/\/\/(business|admin)\./, "//") : window.location.origin;

/** Path of an admin page inside this app host. */
export const ap = (sub = "") => (IS_ADMIN_HOST ? sub || "/" : `/admin${sub}`);

/** Link into the admin area from the members site. */
export function AdminLink({ to = "", children, ...rest }) {
  if (EXTERNAL_ADMIN) return <a href={`${ADM}${to}`} {...rest}>{children}</a>;
  return <Link to={ap(to)} {...rest}>{children}</Link>;
}

/** Path of a business-area page inside this app host ("" = portal home). */
export const bp = (sub = "") => (IS_BIZ_HOST ? sub || "/" : `/business${sub}`);

/** Link into the business area from anywhere (opens the business address when it lives elsewhere). */
export function BizLink({ to = "", children, ...rest }) {
  if (EXTERNAL_BIZ) return <a href={`${BIZ}${to}`} {...rest}>{children}</a>;
  return <Link to={bp(to)} {...rest}>{children}</Link>;
}

/** Link to the members site from the business host. */
export function MainLink({ to = "/", children, ...rest }) {
  if (IS_BIZ_HOST || IS_ADMIN_HOST) return <a href={`${MAIN_URL}${to}`} {...rest}>{children}</a>;
  return <Link to={to} {...rest}>{children}</Link>;
}

export const assetUrl = (p) => (p ? `${IS_BIZ_HOST || IS_ADMIN_HOST ? window.location.origin : process.env.REACT_APP_BACKEND_URL}${p}` : undefined);
