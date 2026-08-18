import type { ReactNode } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[820px] px-[18px] pb-[90px] pt-6">{children}</div>;
}
