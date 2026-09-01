import { useState } from 'react';
import { getWeekLabel } from '@/lib/week';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconVolume, IconVolumeOff } from '@/components/ui/Icons';
import { useTtsPreference } from '@/hooks/useTtsPreference';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/lib/errors';
import type { Profile } from '@/types/firestore';

export function TopBar({ me }: { me: Profile }) {
  const [ttsEnabled, toggleTts] = useTtsPreference();
  const { isHost, releaseName } = useSession();
  const [confirming, setConfirming] = useState(false);
  const { notify } = useToast();

  return (
    <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-2.5">
        <img src="/logo-dark.png" alt="Blacfox" className="block h-[101px] w-auto" />
        <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] text-text-muted">
          {getWeekLabel()}
        </span>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <Avatar name={me.name} avatarUrl={me.avatarUrl} size="sm" />
        <span className="font-display text-sm font-semibold">{me.name}</span>
        {isHost && <Badge variant="host">Host</Badge>}
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
          onClick={() => setConfirming(true)}
        >
          Not you?
        </button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Stop being ${me.name} on this device?`}
        description="The name goes back on the list for someone else to take, and this device forgets who it voted for. Your vote itself still counts."
        confirmLabel="Switch name"
        danger
        onConfirm={() =>
          releaseName().catch((err) =>
            notify(friendlyError(err, 'Could not release that name. Try again in a moment.')),
          )
        }
      />
    </>
  );
}
