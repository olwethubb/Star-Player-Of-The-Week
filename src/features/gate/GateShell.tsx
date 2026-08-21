import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Single centered gate layout on a dark glass backdrop.
 *
 * Brand copy (logo, heading, body) sits centered above a translucent card that
 * holds the actual action (form, buttons, links). The card has no border of its
 * own — blur and a soft drop shadow carry its depth instead, since a hard outline
 * around a glass panel is the one detail that makes it read as generic rather than
 * designed.
 *
 * Brand content arrives as `brand` rather than as children so the shell can place
 * it above the card. Children are always the action area. */
export function GateShell({ brand, children }: { brand?: ReactNode; children: ReactNode }) {
  return (
    <div className="gate-dark-bg flex min-h-screen flex-col items-center justify-center px-6 py-16 sm:px-10">
      <div className="w-full max-w-[440px]">
        <div className="flex flex-col items-center text-center">
          <GateLogo />
          {brand && <div className="mt-8">{brand}</div>}
        </div>
        <div className="gate-glass-card mt-9 rounded-2xl p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}

/** The logo artwork is white-on-transparent, so on this dark backdrop it needs no
 * plate of its own — the page *is* its ground. */
export function GateLogo() {
  return <img src="/logo.png" alt="Blacfox" className="block h-[75px] w-auto sm:h-[90px]" />;
}

export function GateEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 mb-3 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-accent">{children}</p>
  );
}

export function GateHeading({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <h1
      className={`mx-auto mb-4 mt-0 text-center font-serif text-[clamp(22px,4.2vw,36px)] font-bold italic leading-[1.08] text-on-dark [text-wrap:balance] ${
        wide ? 'max-w-[26ch]' : 'max-w-[18ch]'
      }`}
    >
      {children}
    </h1>
  );
}

export function GateBody({ children }: { children: ReactNode }) {
  return (
    <p className="mx-auto my-0 max-w-[38ch] text-center text-[15px] leading-[1.65] text-on-dark-muted">{children}</p>
  );
}

export function GateActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2.5">{children}</div>;
}

/** Groups the trailing text links and separates them from the primary action, so a
 * stack of them reads as secondary rather than as three competing equals. */
export function GateLinks({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2.5 border-t border-border-soft pt-5">{children}</div>
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
      className={`cursor-pointer border-none bg-transparent p-0 text-[13px] underline decoration-border underline-offset-[3px] transition-colors hover:decoration-accent ${
        subtle ? 'text-text-muted hover:text-text' : 'text-text hover:text-accent'
      } ${className}`}
      {...props}
    />
  );
}
