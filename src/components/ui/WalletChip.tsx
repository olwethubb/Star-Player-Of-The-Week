import { IconWallet } from './Icons';

export function WalletChip({ balance }: { balance: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-3 py-1.5 font-mono text-[13px] font-bold text-text">
      <IconWallet />
      B${(balance || 0).toLocaleString()}
    </span>
  );
}
