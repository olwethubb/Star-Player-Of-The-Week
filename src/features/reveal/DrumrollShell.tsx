import type { ReactNode } from 'react';

export function DrumrollShell({ children }: { children: ReactNode }) {
  return (
    <div className="mt-[6vh] flex min-h-[min(560px,70vh)] flex-col rounded-[20px] bg-bg-card px-6 pb-10 pt-11 text-center shadow-card sm:px-10">
      <div className="mx-auto flex max-w-none flex-1 flex-col items-center">{children}</div>
    </div>
  );
}
