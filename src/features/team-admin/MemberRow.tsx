import { useState } from 'react';
import { getDocs, query, where } from 'firebase/firestore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTeamActions } from '@/hooks/useTeamActions';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/lib/errors';
import { balanceAdjustmentsCol } from '@/lib/firebase';
import { forgotPassword } from '@/services/auth.service';
import type { BalanceAdjustment, Profile } from '@/types/firestore';

interface MemberRowProps {
  uid: string;
  profile: Profile;
  balance: number;
  holdsFinance: boolean;
  actions: ReturnType<typeof useTeamActions>;
}

/** Fetched on demand (not a live subscription — this is rarely-viewed audit
 * detail, not something that needs to be always-on for every row). A plain
 * equality filter with no orderBy avoids needing a composite index; the
 * handful of results are sorted client-side instead. */
function BalanceHistory({ uid }: { uid: string }) {
  const [entries, setEntries] = useState<BalanceAdjustment[] | null>(null);
  const { notify } = useToast();

  async function load() {
    try {
      const snap = await getDocs(query(balanceAdjustmentsCol, where('uid', '==', uid)));
      const rows = snap.docs
        .map((d) => d.data())
        .sort((a, b) => (b.ts?.toMillis() ?? 0) - (a.ts?.toMillis() ?? 0))
        .slice(0, 5);
      setEntries(rows);
    } catch (err) {
      notify(friendlyError(err, 'Could not load balance history. Try again in a moment.'));
    }
  }

  if (entries === null) {
    return (
      <button
        type="button"
        onClick={load}
        className="cursor-pointer border-none bg-transparent p-0 text-[11px] text-text-muted underline decoration-border underline-offset-[3px] hover:text-text hover:decoration-accent"
      >
        History
      </button>
    );
  }

  return (
    <div className="mt-1.5 w-full text-[11px] text-text-muted">
      {entries.length === 0 ? (
        <p className="m-0">No manual balance edits on record.</p>
      ) : (
        entries.map((e, i) => (
          <p key={i} className="m-0">
            B${e.from} → B${e.to}
          </p>
        ))
      )}
    </div>
  );
}

export function MemberRow({ uid, profile, balance, holdsFinance, actions }: MemberRowProps) {
  const isOwnerRow = profile.role === 'owner';
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const { notify } = useToast();

  function saveName(value: string) {
    setEditingName(false);
    if (value.trim() && value.trim() !== profile.name) {
      actions.renameTeammate(uid, value);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border-soft py-3 last:border-b-0">
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
          onBlur={(e) => actions.updateBalance(uid, e.target.value, balance || 0)}
          className="min-h-[38px] w-[76px] rounded-lg border border-border bg-bg-card px-2 py-2 font-mono text-[13px] text-text focus:border-accent focus:outline-none"
        />
        {!isOwnerRow && (
          <Button variant="small" onClick={() => actions.setRole(uid, profile.role === 'admin' ? 'member' : 'admin')}>
            {profile.role === 'admin' ? 'Remove admin' : 'Make admin'}
          </Button>
        )}
        <Button
          variant="small"
          onClick={() => (holdsFinance ? actions.clearFinanceHolder() : actions.assignFinanceHolder(uid))}
        >
          {holdsFinance ? 'Remove finance' : 'Make finance'}
        </Button>
        <Button
          variant="small"
          onClick={() =>
            forgotPassword(profile.email)
              .then(() => notify('Password reset email sent.', 'success'))
              .catch((err) => notify(friendlyError(err, 'Could not send a reset email. Try again in a moment.')))
          }
        >
          Reset password
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
      <BalanceHistory uid={uid} />
    </div>
  );
}
