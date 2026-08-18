import type { ReactNode } from 'react';

export function Badge({ variant, children }: { variant: 'owner' | 'admin' | 'finance'; children: ReactNode }) {
  const styles = {
    owner: 'bg-accent text-accent-contrast border-transparent',
    admin: 'border-accent text-accent bg-transparent',
    finance: 'border-text-muted text-text-muted bg-transparent',
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-[3px] font-mono text-[10px] font-bold tracking-[0.03em] ${styles[variant]}`}
    >
      {children}
    </span>
  );
}
