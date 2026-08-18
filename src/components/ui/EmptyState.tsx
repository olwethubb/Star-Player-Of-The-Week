import type { ReactNode } from 'react';

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-5 py-11 text-center text-text-muted">
      {children}
    </div>
  );
}
