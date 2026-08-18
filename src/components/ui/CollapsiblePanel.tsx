import type { ReactNode } from 'react';

export function CollapsiblePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group mb-4 overflow-hidden rounded-2xl border border-border bg-bg-elevated">
      <summary className="flex cursor-pointer list-none items-center justify-between px-[18px] py-[15px] text-sm font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <span className="text-lg text-text-muted group-open:hidden">+</span>
        <span className="hidden text-lg text-text-muted group-open:inline">−</span>
      </summary>
      <div className="px-[18px] pb-[18px]">{children}</div>
    </details>
  );
}
