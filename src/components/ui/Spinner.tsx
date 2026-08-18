export function Spinner({ label = 'Loading', errorMsg }: { label?: string; errorMsg?: string | null }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-border border-t-accent" />
      <div className="font-mono text-xs uppercase tracking-[0.05em] text-text-muted">{label}</div>
      {errorMsg && <p className="max-w-[320px] text-center text-[13px] leading-relaxed text-accent">{errorMsg}</p>}
    </div>
  );
}
