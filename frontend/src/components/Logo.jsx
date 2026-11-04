export function LogoMark({ className = "h-8 w-auto" }) {
  return <img src="/brand/go-perks-mark.png" alt="" aria-hidden="true" className={`${className} select-none`} draggable="false" />;
}

export function Logo({ light = false, className = "h-9 w-auto" }) {
  return (
    <img
      src={light ? "/brand/go-perks-logo-horizontal-light.png" : "/brand/go-perks-logo-horizontal.png"}
      alt="Go Perks"
      className={`${className} select-none`}
      draggable="false"
    />
  );
}

export function LogoStacked({ light = false, className = "h-28 w-auto" }) {
  return (
    <img
      src={light ? "/brand/go-perks-logo-stacked-light.png" : "/brand/go-perks-logo-stacked.png"}
      alt="Go Perks"
      className={`${className} select-none`}
      draggable="false"
    />
  );
}
