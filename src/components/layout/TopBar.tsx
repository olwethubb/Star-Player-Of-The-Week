import { logout } from '@/services/auth.service';
import { getWeekLabel } from '@/lib/week';
import { WalletChip } from '@/components/ui/WalletChip';
import { Badge } from '@/components/ui/Badge';
import { IconVolume, IconVolumeOff } from '@/components/ui/Icons';
import { useTtsPreference } from '@/hooks/useTtsPreference';
import type { Profile } from '@/types/firestore';

export function TopBar({ me, balance }: { me: Profile; balance: number }) {
  const [ttsEnabled, toggleTts] = useTtsPreference();

  return (
    <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-2.5">
        {/* Dark plate: the logo artwork is white-on-transparent and would otherwise
            be invisible against the light theme's background. */}
        <div className="rounded-2xl bg-text px-4 py-2.5">
          <img src="/logo.png" alt="Blacfox" className="block h-[84px] w-auto" />
        </div>
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
          type="button"
          aria-label={ttsEnabled ? 'Mute the reveal announcement' : 'Unmute the reveal announcement'}
          aria-pressed={ttsEnabled}
          title={ttsEnabled ? 'Reveal announcement: on' : 'Reveal announcement: muted'}
          onClick={toggleTts}
          className="ml-auto flex cursor-pointer items-center justify-center rounded-full border border-border bg-transparent p-1.5 text-text-muted hover:border-accent hover:text-accent"
        >
          {ttsEnabled ? <IconVolume /> : <IconVolumeOff />}
        </button>
        <button
          className="cursor-pointer border-none bg-transparent p-1 text-[13px] text-text-muted underline"
          onClick={() => logout()}
        >
          Log out
        </button>
      </div>
    </>
  );
}
