import type { ReactNode } from 'react';

/** Single centred layout on a dark glass backdrop, used by the name picker — the
 * only screen that renders outside AppShell.
 *
 * Brand copy (logo, heading, body) sits centred above a translucent card that holds
 * the actual action. The card has no border of its own — blur and a soft drop shadow
 * carry its depth instead, since a hard outline around a glass panel is the one
 * detail that makes it read as generic rather than designed.
 *
 * Brand content arrives as `brand` rather than as children so the shell can place it
 * above the card. Children are always the action area. */
export function PickerShell({ brand, children }: { brand?: ReactNode; children: ReactNode }) {
  return (
    <div className="gate-dark-bg flex min-h-screen flex-col items-center justify-center px-6 py-16 sm:px-10">
      <div className="w-full max-w-[440px]">
        <div className="flex flex-col items-center text-center">
          {/* The logo artwork is white-on-transparent, so on this dark backdrop it
              needs no plate of its own — the page *is* its ground. */}
          <img src="/logo.png" alt="Blacfox" className="block h-[75px] w-auto sm:h-[90px]" />
          {brand && <div className="mt-8">{brand}</div>}
        </div>
        <div className="gate-glass-card mt-9 rounded-2xl p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}

export function PickerEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 mb-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-accent">{children}</p>
  );
}

/** Bold, upright Montserrat — blacfox's own heading voice. An emphasized word or
 * phrase isn't styled here: wrap it in the `em` component below at the call site,
 * same split blacfox's own hero title makes ("We listen. *You close.*"). */
export function PickerHeading({ children }: { children: ReactNode }) {
  return (
    <h1 className="mx-auto mb-4 mt-0 max-w-[20ch] text-center text-[clamp(24px,4.6vw,38px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-dark [text-wrap:balance]">
      {children}
    </h1>
  );
}

/** The one emphasized word or phrase in a heading — italic, orange, still the same
 * weight as the rest of the line. Use inside PickerHeading or any other heading that
 * wants blacfox's accent-word treatment. */
export function HeadingAccent({ children }: { children: ReactNode }) {
  return <em className="text-accent italic">{children}</em>;
}

export function PickerBody({ children }: { children: ReactNode }) {
  return (
    <p className="mx-auto my-0 max-w-[38ch] text-center text-[15px] leading-[1.65] text-on-dark-muted">{children}</p>
  );
}
