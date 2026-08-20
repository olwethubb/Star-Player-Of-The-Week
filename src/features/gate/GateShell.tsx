import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Two-panel gate layout, deliberately not a card.
 *
 * The old design was one wide white card whose content was capped at 420px, so on
 * desktop the right half was dead space — and being white-on-cream, the card barely
 * read as an edge at all. This splits the viewport instead: a dark brand panel and a
 * light action panel, so both halves carry weight and the dark/light seam does the
 * anchoring a low-contrast card border couldn't.
 *
 * Brand content arrives as `brand` rather than as children so the shell can place it
 * in the other column. Children are always the action area (form, buttons, links).
 * The brand panel holds nothing focusable, so this split doesn't disturb tab order —
 * keyboard focus still lands on the form first. */
export function GateShell({ brand, children }: { brand?: ReactNode; children: ReactNode }) {
  return (
    <div className="gate-rays gate-shell-gradient relative isolate min-h-screen overflow-hidden lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative px-6 pb-12 pt-9 sm:px-10 lg:flex lg:flex-col lg:justify-between lg:pb-14 lg:pt-14">
        <GateLogo />
        {brand && <div className="relative z-10 mt-9 lg:mt-0">{brand}</div>}
      </aside>
      <main className="relative z-10 flex items-start justify-center px-6 pb-14 pt-10 sm:px-10 lg:items-center lg:py-16">
        <div className="w-full max-w-[420px]">
          {/* A contained surface, not the old full-width card: sized to its content so
              it reads as a deliberate action panel instead of text adrift in a void. */}
          <div className="rounded-2xl border border-border bg-bg-card p-6 shadow-card sm:p-7">{children}</div>
        </div>
      </main>
    </div>
  );
}

/** The logo artwork is white-on-transparent, so on the dark brand panel it needs no
 * plate of its own — the panel *is* its ground. `self-start` matters: as a flex child
 * of the column-flex panel it would otherwise stretch to the full cross-axis width. */
export function GateLogo() {
  return (
    <img
      src="/logo.png"
      alt="Blacfox"
      className="relative z-10 block h-[60px] w-auto self-start sm:h-[72px]"
    />
  );
}

export function GateEyebrow({ children }: { children: ReactNode }) {
  return <p className="m-0 mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">{children}</p>;
}

export function GateHeading({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <h1
      className={`m-0 mb-4 font-serif text-[clamp(30px,4.2vw,50px)] font-bold italic leading-[1.06] text-on-dark [text-wrap:balance] ${
        wide ? 'max-w-[24ch]' : 'max-w-[16ch]'
      }`}
    >
      {children}
    </h1>
  );
}

export function GateBody({ children }: { children: ReactNode }) {
  return <p className="m-0 max-w-[40ch] text-[15px] leading-[1.65] text-on-dark-muted">{children}</p>;
}

export function GateActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2.5">{children}</div>;
}

/** Groups the trailing text links and separates them from the primary action, so a
 * stack of them reads as secondary rather than as three competing equals. */
export function GateLinks({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 flex flex-col items-start gap-2.5 border-t border-border-soft pt-5">{children}</div>
  );
}

export function GateLink({
  subtle,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { subtle?: boolean }) {
  return (
    <button
      type="button"
      className={`cursor-pointer border-none bg-transparent p-0 text-left text-[13px] underline decoration-border underline-offset-[3px] transition-colors hover:decoration-accent ${
        subtle ? 'text-text-muted hover:text-text' : 'text-text hover:text-accent'
      } ${className}`}
      {...props}
    />
  );
}
