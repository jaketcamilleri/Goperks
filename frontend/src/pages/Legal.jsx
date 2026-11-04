import { Link } from "react-router-dom";
import { TERMS, PRIVACY, LAST_UPDATED } from "@/lib/legal";

const DOCS = {
  terms: { title: "Terms and conditions", sections: TERMS, other: ["/privacy", "Privacy policy"] },
  privacy: { title: "Privacy policy", sections: PRIVACY, other: ["/terms", "Terms and conditions"] },
};

/** Terms and conditions or privacy policy. */
export default function Legal({ doc }) {
  const d = DOCS[doc];
  return (
    <article className="mx-auto max-w-3xl px-5 pb-28 pt-10 sm:px-8 lg:pt-16" data-testid={`legal-${doc}-page`}>
      <p className="text-sm font-semibold uppercase tracking-wider text-[#9A4024]">Go Perks</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{d.title}</h1>
      <p className="mt-3 text-sm text-[#3D5E65]" data-testid="legal-updated">Last updated {LAST_UPDATED}</p>
      <div className="mt-10 space-y-9">
        {d.sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-display text-xl font-semibold text-[#17434C]">{s.h}</h2>
            {s.p.map((t, i) => <p key={i} className="mt-3 leading-relaxed text-[#24474F]">{t}</p>)}
          </section>
        ))}
      </div>
      <p className="mt-14 border-t border-[#C2DEDA] pt-6 text-sm">
        See also our <Link to={d.other[0]} className="font-semibold text-[#9A4024] underline" data-testid="legal-other-link">{d.other[1]}</Link>.
      </p>
    </article>
  );
}
