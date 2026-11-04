import { Link } from "react-router-dom";

/** Members site, business area (/business) and admin (/admin) all run on one address. */
const HOST = window.location.hostname;
// On the live domain (e.g. goperks.au) the API is served from the same address, which keeps sign-in cookies first-party.
const ON_CUSTOM_DOMAIN = !/(^localhost$|emergentagent\.com$|emergent\.host$|emergentcf\.cloud$)/.test(HOST);
export const API_BASE = ON_CUSTOM_DOMAIN ? window.location.origin : process.env.REACT_APP_BACKEND_URL;
export const MAIN_URL = window.location.origin;

/** Path of an admin page. */
export const ap = (sub = "") => `/admin${sub}`;

/** Path of a business-area page ("" = portal home). */
export const bp = (sub = "") => `/business${sub}`;

export function AdminLink({ to = "", children, ...rest }) {
  return <Link to={ap(to)} {...rest}>{children}</Link>;
}

export function BizLink({ to = "", children, ...rest }) {
  return <Link to={bp(to)} {...rest}>{children}</Link>;
}

export function MainLink({ to = "/", children, ...rest }) {
  return <Link to={to} {...rest}>{children}</Link>;
}

export const assetUrl = (p) => (p ? `${API_BASE}${p}` : undefined);
