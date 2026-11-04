import { useState } from "react";
import { toast } from "sonner";
import { api, formatErr } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { btn } from "@/admin/DataTable";
import { assetUrl } from "@/lib/site";

const field = "mt-1 h-10 w-full rounded-lg border border-[#D7E7E4] bg-white px-3 text-sm outline-none focus:border-[#17434C]";

export function AddPersonDialog({ role, open, onClose, onCreated }) {
  const isBiz = role === "business";
  const isStaff = role === "staff";
  const blank = { name: "", email: "", business_name: "", password: "", activate: true, send_invite: true };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/admin/users", { role, name: f.name, email: f.email, business_name: isBiz ? f.business_name : null,
        password: f.password || null, activate: !isBiz && !isStaff && f.activate, send_invite: f.send_invite });
      toast.success(isBiz ? "Business added and approved" : isStaff ? "Staff member added" : "Customer added");
      setF(blank); onCreated(); onClose();
    } catch (err) { toast.error(formatErr(err)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-w-md bg-[#F3F8F7]" data-testid={`add-${role}-dialog`}>
        <DialogHeader><DialogTitle className="font-display text-2xl">{isBiz ? "Add a business" : isStaff ? "Add a staff member" : "Add a customer"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {isBiz && <label className="block text-sm font-medium">Business name<input required value={f.business_name} onChange={set("business_name")} className={field} data-testid="add-business-name" /></label>}
          <label className="block text-sm font-medium">{isBiz ? "Contact name" : "Full name"}<input required value={f.name} onChange={set("name")} className={field} data-testid="add-person-name" /></label>
          <label className="block text-sm font-medium">Email<input required type="email" value={f.email} onChange={set("email")} className={field} data-testid="add-person-email" /></label>
          <label className="block text-sm font-medium">Password <span className="font-normal text-[#3D5E65]">(optional)</span>
            <input type="text" minLength={6} value={f.password} onChange={set("password")} placeholder="Leave blank and they'll choose one" className={field} data-testid="add-person-password" />
          </label>
          {!isBiz && !isStaff && (
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={f.activate} onChange={set("activate")} className="mt-0.5 h-4 w-4 accent-[#17434C]" data-testid="add-person-activate" />
              <span><b>Make membership valid now</b><br /><span className="text-[#3D5E65]">12 months free, member card issued and emailed. No payment taken.</span></span></label>
          )}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={f.send_invite} onChange={set("send_invite")} className="mt-0.5 h-4 w-4 accent-[#17434C]" data-testid="add-person-invite" />
            <span><b>Email them a link to set their password</b><br /><span className="text-[#3D5E65]">Valid for 3 days.</span></span></label>
          {isBiz && <p className="rounded-lg bg-white p-3 text-xs text-[#3D5E65]">Businesses you add are approved straight away and get their partner kit. They'll still fill in their profile before adding deals.</p>}
          {isStaff && <p className="rounded-lg bg-white p-3 text-xs text-[#3D5E65]">Staff can approve deals and businesses, edit deals and check codes. They can't see revenue, payments, members or the team.</p>}
          <button disabled={busy} className={`${btn.primary} w-full justify-center`} data-testid="add-person-submit">{busy ? "Adding…" : isBiz ? "Add business" : isStaff ? "Add staff member" : "Add customer"}</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BusinessDialog({ biz, owner, onClose, onSaved }) {
  const [busy, setBusy] = useState("");
  if (!biz) return null;
  const run = async (key, fn, msg) => {
    setBusy(key);
    try { await fn(); toast.success(msg); onSaved(); } catch (err) { toast.error(formatErr(err)); } finally { setBusy(""); }
  };
  const decide = (status) => {
    let note = null;
    if (status === "rejected") { const a = window.prompt("Optional: a short reason (included in their email).", ""); if (a === null) return; note = a.trim() || null; }
    run(status, () => api.post(`/admin/businesses/${biz.id}/status`, { status, note }), status === "approved" ? "Approved — partner kit emailed" : "Rejected — they've been emailed");
  };
  const rows = [["Contact", `${biz.name} · ${biz.email}`], ["Address", [biz.address, biz.suburb].filter(Boolean).join(", ")], ["Phone", biz.phone],
    ["Website", biz.website], ["Instagram", biz.instagram && `@${biz.instagram}`], ["Hours", biz.opening_hours], ["About", biz.about]];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-h-[90vh] max-w-lg overflow-y-auto bg-[#F3F8F7]" data-lenis-prevent data-testid="business-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-display text-2xl">
            {biz.logo_url && <img src={assetUrl(biz.logo_url)} alt="" className="h-10 w-10 rounded-lg object-contain" />}{biz.business_name || biz.name}
          </DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-sm text-[#3D5E65]">Status: <b data-testid="business-dialog-status">{biz.business_status || "pending"}</b> · {biz.deal_count ?? 0} deals · {biz.profile_complete ? "profile complete" : "profile not completed"}</p>
        <dl className="divide-y divide-[#E3F0ED] rounded-xl border border-[#D7E7E4] bg-white text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[90px_1fr] gap-3 px-3 py-2"><dt className="text-[#3D5E65]">{k}</dt><dd className="whitespace-pre-line break-words">{v || "—"}</dd></div>
          ))}
        </dl>
        {Array.isArray(biz.photos) && biz.photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2" data-testid="business-dialog-photos">
            {biz.photos.map((p) => <img key={p.path} src={assetUrl(p.url)} alt="" className="aspect-square w-full rounded-lg object-cover" />)}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {biz.business_status !== "approved" && <button disabled={!!busy} onClick={() => decide("approved")} className={btn.dark} data-testid="business-dialog-approve">Approve</button>}
          {biz.business_status !== "rejected" && <button disabled={!!busy} onClick={() => decide("rejected")} className={btn.danger} data-testid="business-dialog-reject">Reject</button>}
          {owner && <button disabled={!!busy} onClick={() => run("pw", () => api.post(`/admin/users/${biz.id}/password-link`), "Password link sent")} className={btn.ghost} data-testid="business-dialog-password-link">Send password link</button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const toDateInput = (iso) => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" }) : "");

export function MemberDialog({ member, onClose, onSaved }) {
  const [name, setName] = useState(member?.name || "");
  const [exp, setExp] = useState(toDateInput(member?.membership_expires_at));
  const [busy, setBusy] = useState("");
  if (!member) return null;
  const active = member.membership_status === "active";

  const run = async (key, fn, msg) => {
    setBusy(key);
    try { await fn(); toast.success(msg); onSaved(); } catch (err) { toast.error(formatErr(err)); } finally { setBusy(""); }
  };
  const patch = (body, msg) => run(Object.keys(body)[0], () => api.patch(`/admin/users/${member.id}`, body), msg);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-w-md bg-[#F3F8F7]" data-testid="member-dialog">
        <DialogHeader><DialogTitle className="font-display text-2xl">{member.name}</DialogTitle></DialogHeader>
        <p className="-mt-2 text-sm text-[#3D5E65]">{member.email} · {member.member_code || "no card yet"}</p>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} aria-label="Name" data-testid="member-name-input" />
            <button disabled={!!busy || !name.trim() || name === member.name} onClick={() => patch({ name }, "Name updated")} className={`${btn.dark} mt-1 h-10`} data-testid="member-name-save">Save</button>
          </div>
          <div className="rounded-xl border border-[#D7E7E4] bg-white p-4">
            <p className="text-sm font-semibold">Membership: <span className={active ? "text-[#2F5A3A]" : "text-[#9A4024]"} data-testid="member-status">{member.membership_status}</span></p>
            <label className="mt-3 block text-sm font-medium">Valid until
              <div className="flex gap-2">
                <input type="date" value={exp} onChange={(e) => setExp(e.target.value)} className={field} data-testid="member-expiry-input" />
                <button disabled={!!busy || !exp} onClick={() => patch({ expires_on: exp }, "Expiry updated — membership is valid")} className={`${btn.dark} mt-1 h-10`} data-testid="member-expiry-save">Set</button>
              </div>
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={!!busy} onClick={() => patch({ membership: "activate" }, active ? "Added 12 months" : "Membership is now valid for 12 months")} className={btn.primary} data-testid="member-activate">{active ? "Add 12 months" : "Make valid (12 months)"}</button>
              {active && <button disabled={!!busy} onClick={() => window.confirm("Turn off this membership?") && patch({ membership: "deactivate" }, "Membership turned off")} className={btn.danger} data-testid="member-deactivate">Deactivate</button>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={!!busy || !active} onClick={() => run("card", () => api.post(`/admin/users/${member.id}/resend-card`), "Card email sent")} className={btn.ghost} data-testid="member-resend-card">Resend card email</button>
            <button disabled={!!busy} onClick={() => run("pw", () => api.post(`/admin/users/${member.id}/password-link`), "Password link sent")} className={btn.ghost} data-testid="member-password-link">Send password link</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
