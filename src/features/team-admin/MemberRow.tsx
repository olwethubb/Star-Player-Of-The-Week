import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTeamActions } from '@/hooks/useTeamActions';
import { isHostName, type Profile } from '@/types/firestore';

interface MemberRowProps {
  uid: string;
  profile: Profile;
  /** Someone's browser currently holds this name, so nobody else can vote as them. */
  claimed: boolean;
  isMe: boolean;
  actions: ReturnType<typeof useTeamActions>;
}

export function MemberRow({ uid, profile, claimed, isMe, actions }: MemberRowProps) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [confirmingRelease, setConfirmingRelease] = useState(false);
  const [editingName, setEditingName] = useState(false);

  function saveName(value: string) {
    setEditingName(false);
    if (value.trim() && value.trim() !== profile.name) {
      actions.renameTeammate(uid, value);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border-soft py-3 last:border-b-0">
      <Avatar name={profile.name} size="sm" />
      <div className="flex min-w-[150px] flex-1 items-center gap-2">
        {editingName ? (
          <input
            type="text"
            defaultValue={profile.name}
            autoFocus
            onBlur={(e) => saveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setEditingName(false);
            }}
            className="min-w-0 flex-1 rounded-lg border border-border bg-bg-card px-2 py-1.5 font-display text-sm font-semibold text-text focus:border-accent focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            title="Click to rename"
            className="cursor-pointer border-none bg-transparent p-0 text-left font-display text-sm font-semibold [overflow-wrap:anywhere] hover:text-accent"
          >
            {profile.name}
          </button>
        )}
        {isHostName(profile.name) && <Badge variant="host">Host</Badge>}
        {claimed && <Badge variant="muted">{isMe ? 'You' : 'In use'}</Badge>}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {claimed && !isMe && (
          <>
            {/* For the "lost my phone / cleared my browser" case: the name is stuck on
                a device nobody has any more, so its owner can't get back in. Freeing
                it keeps the person and their history — only the device binding goes. */}
            <Button variant="small" onClick={() => setConfirmingRelease(true)}>
              Free up name
            </Button>
            <ConfirmDialog
              open={confirmingRelease}
              onOpenChange={setConfirmingRelease}
              title={`Free up ${profile.name}?`}
              description="Use this if they've lost their phone or cleared their browser and can't get back in. Whoever taps the name next takes it — make sure it's actually them."
              confirmLabel="Free up name"
              danger
              onConfirm={() => actions.releaseClaimFor(uid)}
            />
          </>
        )}
        {!isMe && (
          <>
            <Button variant="danger" onClick={() => setConfirmingRemove(true)}>
              Remove
            </Button>
            <ConfirmDialog
              open={confirmingRemove}
              onOpenChange={setConfirmingRemove}
              title={`Remove ${profile.name}?`}
              description="They come off the roster and lose access immediately. Any vote they already cast this week still counts — it can't be traced back to take out."
              confirmLabel="Remove"
              danger
              onConfirm={() => actions.removeTeammate(uid)}
            />
          </>
        )}
      </div>
    </div>
  );
}
