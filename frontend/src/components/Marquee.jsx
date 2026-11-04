const WORDS = ["Cafes & brunch", "Kids activities", "Dining out", "Family days", "Everyday essentials", "Weekend getaways"];

export function Marquee() {
  const items = [...WORDS, ...WORDS];
  return (
    <section className="relative overflow-hidden border-y border-[#17434C] bg-[#EAF6F3] py-6 sm:py-8" data-testid="editorial-marquee">
      <div className="marquee-track flex w-max items-center whitespace-nowrap">
        {items.map((w, i) => (
          <span key={i} className="flex items-center">
            <span className={`px-6 font-display text-4xl sm:text-6xl lg:text-7xl ${i % 2 ? "italic font-normal text-[#B9512E]" : "font-semibold text-[#17434C]"}`}>
              {w}
            </span>
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-[#EE8A63] sm:h-10 sm:w-10" aria-hidden="true">
              <path fill="currentColor" d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" />
            </svg>
          </span>
        ))}
      </div>
    </section>
  );
}
