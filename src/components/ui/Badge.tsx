import type { ReactNode } from 'react';

type Variant = 'host' | 'outline' | 'muted';

export function Badge({ variant, children }: { variant: Variant; children: ReactNode }) {
  const styles: Record<Variant, string> = {
    host: 'bg-accent text-accent-contrast border-transparent',
    outline: 'border-accent text-accent bg-transparent',
    muted: 'border-border text-text-muted bg-transparent',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-[3px] font-mono text-[10px] font-bold tracking-[0.03em] ${styles[variant]}`}
    >
      {children}
    </span>
  );
}
