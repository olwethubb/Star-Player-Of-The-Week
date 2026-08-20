import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function GateShell({ children }: { children: ReactNode }) {
  return (
    <div className="burst mt-[6vh] flex min-h-[min(560px,70vh)] flex-col rounded-[20px] bg-bg-card px-6 pb-10 pt-11 shadow-card sm:px-10">
      <div className="relative z-[1] flex max-w-[420px] flex-1 flex-col">{children}</div>
    </div>
  );
}

/** The logo artwork is white-on-transparent, so on the light theme's white card it
 * needs a dark plate behind it to be visible at all. */
export function GateLogo() {
  return (
    <div className="mb-9 self-start rounded-2xl bg-text px-5 py-3 sm:mb-16">
      <img src="/logo.png" alt="Blacfox" className="block h-[104px] w-auto" />
    </div>
  );
}

export function GateEyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">{children}</p>;
}

export function GateHeading({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <h1
      className={`m-0 mb-2 font-serif text-[clamp(24px,6vw,34px)] font-bold italic leading-[1.15] ${
        wide ? 'max-w-[26ch]' : 'max-w-[15ch]'
      }`}
    >
      {children}
    </h1>
  );
}

export function GateBody({ children }: { children: ReactNode }) {
  return <p className="mb-[30px] max-w-[34ch] text-[14.5px] leading-[1.7] text-text-muted">{children}</p>;
}

export function GateActions({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-col gap-3">{children}</div>;
}

export function GateLink({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="mt-3.5 block cursor-pointer border-none bg-transparent p-0 text-left text-[13px] text-text-muted underline"
      {...props}
    >
      {children}
    </button>
  );
}
