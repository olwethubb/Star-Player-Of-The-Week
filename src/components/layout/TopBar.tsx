import { logout } from '@/services/auth.service';
import { getWeekLabel } from '@/lib/week';
import { WalletChip } from '@/components/ui/WalletChip';
import { Badge } from '@/components/ui/Badge';
import type { Profile } from '@/types/firestore';

export function TopBar({ me, balance }: { me: Profile; balance: number }) {
  return (
    <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-2.5">
        <img src="/logo.png" alt="Blacfox" className="block h-[133px] w-auto" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] text-text-muted">
            {getWeekLabel()}
          </span>
          <WalletChip balance={balance} />
        </div>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <span className="font-display text-sm font-semibold">{me.name}</span>
        {me.role === 'owner' && <Badge variant="owner">Owner</Badge>}
        {me.role === 'admin' && <Badge variant="admin">Admin</Badge>}
        <button
          className="ml-auto cursor-pointer border-none bg-transparent p-1 text-[13px] text-text-muted underline"
          onClick={() => logout()}
        >
          Log out
        </button>
      </div>
    </>
  );
}
