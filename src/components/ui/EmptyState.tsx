import type { ReactNode } from 'react';

export function EmptyState({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-5 py-11 text-center text-text-muted">
      {icon && <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-border-soft text-accent">{icon}</div>}
      <div className="mx-auto max-w-[38ch] leading-relaxed">{children}</div>
    </div>
  );
}
