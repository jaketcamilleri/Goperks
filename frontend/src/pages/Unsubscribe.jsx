import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, formatErr } from "@/lib/api";
import { Eyebrow } from "@/components/Reveal";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState({ busy: false, done: null, error: "" });

  const confirm = async () => {
    setState({ busy: true, done: null, error: "" });
    try {
      const { data } = await api.post("/invites/unsubscribe", { token });
      setState({ busy: false, done: data?.email || "your email", error: "" });
    } catch (e) { setState({ busy: false, done: null, error: formatErr(e) }); }
  };

  return (
    <div className="mx-auto max-w-xl px-5 pb-28 pt-14" data-testid="unsubscribe-page">
      <Eyebrow>Email preferences</Eyebrow>
      <h1 className="mt-5 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        {state.done ? "You're unsubscribed." : "Stop invite emails?"}
      </h1>
      {state.done ? (
        <p className="mt-5 text-[#3D5E65]" data-testid="unsubscribe-done">We won't send invites to <span className="font-semibold text-[#17434C]">{state.done}</span> again. Changed your mind? You can still <Link to="/join" className="font-semibold text-[#9A4024]">join any time</Link>.</p>
      ) : (
        <>
          <p className="mt-5 text-[#3D5E65]">Tap below and we won't email you any more invites to join Go Perks.</p>
          {!token && <p className="mt-6 rounded-2xl bg-[#FDF0EC] p-4 text-sm text-[#9A4024]" data-testid="unsubscribe-missing">This link is missing its code. Please use the link from your email.</p>}
          {state.error && <p className="mt-6 rounded-2xl bg-[#FDF0EC] p-4 text-sm text-[#9A4024]" data-testid="unsubscribe-error">{state.error}</p>}
          <button onClick={confirm} disabled={!token || state.busy} data-testid="unsubscribe-confirm-btn"
            className="mt-8 w-full rounded-full bg-[#17434C] py-4 font-semibold text-[#EAF6F3] transition-[background-color,transform] hover:bg-[#0F3138] active:scale-[0.98] disabled:opacity-50">
            {state.busy ? "Unsubscribing…" : "Unsubscribe me"}
          </button>
        </>
      )}
    </div>
  );
}
