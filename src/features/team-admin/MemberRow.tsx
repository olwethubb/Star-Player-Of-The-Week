import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTeamActions } from '@/hooks/useTeamActions';
import type { Profile } from '@/types/firestore';

interface MemberRowProps {
  uid: string;
  profile: Profile;
  balance: number;
  holdsFinance: boolean;
  actions: ReturnType<typeof useTeamActions>;
}

export function MemberRow({ uid, profile, balance, holdsFinance, actions }: MemberRowProps) {
  const isOwnerRow = profile.role === 'owner';
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border-soft py-3 last:border-b-0">
      <div className="flex min-w-[150px] flex-1 items-center gap-2">
        <span className="font-display text-sm font-semibold [overflow-wrap:anywhere]">{profile.name}</span>
        {isOwnerRow && <Badge variant="owner">Owner</Badge>}
        {!isOwnerRow && profile.role === 'admin' && <Badge variant="admin">Admin</Badge>}
        {holdsFinance && <Badge variant="finance">Finance</Badge>}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <input
          // Remounts (discarding any unsaved edit) whenever the live balance changes
          // underneath it — a stale defaultValue would otherwise get written back on
          // blur and silently clobber a newer value from another admin's edit or a
          // payout/bonus posting while this panel stayed open.
          key={balance}
          type="number"
          title="Balance (B$)"
          defaultValue={balance || 0}
          onBlur={(e) => actions.updateBalance(uid, e.target.value)}
          className="min-h-[38px] w-[76px] rounded-lg border border-border bg-bg-card px-2 py-2 font-mono text-[13px] text-text focus:border-accent focus:outline-none"
        />
        {!isOwnerRow && (
          <Button variant="small" onClick={() => actions.setRole(uid, profile.role === 'admin' ? 'member' : 'admin')}>
            {profile.role === 'admin' ? 'Remove admin' : 'Make admin'}
          </Button>
        )}
        <Button variant="small" onClick={() => actions.setFinanceHolder(uid)}>
          {holdsFinance ? 'Remove finance' : 'Make finance'}
        </Button>
        {!isOwnerRow && (
          <>
            <Button variant="danger" onClick={() => setConfirmingRemove(true)}>
              Remove
            </Button>
            <ConfirmDialog
              open={confirmingRemove}
              onOpenChange={setConfirmingRemove}
              title={`Remove ${profile.name}?`}
              description="They'll lose access to the app immediately."
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
