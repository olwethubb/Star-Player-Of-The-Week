import { Badge } from '@/components/ui/Badge';
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
          <button
            className="min-h-9 cursor-pointer whitespace-nowrap rounded-full border border-border bg-transparent px-3 py-2 text-xs text-text hover:border-accent hover:text-accent"
            onClick={() => actions.setRole(uid, profile.role === 'admin' ? 'member' : 'admin')}
          >
            {profile.role === 'admin' ? 'Remove admin' : 'Make admin'}
          </button>
        )}
        <button
          className="min-h-9 cursor-pointer whitespace-nowrap rounded-full border border-border bg-transparent px-3 py-2 text-xs text-text hover:border-accent hover:text-accent"
          onClick={() => actions.setFinanceHolder(uid)}
        >
          {holdsFinance ? 'Remove finance' : 'Make finance'}
        </button>
        {!isOwnerRow && (
          <button
            className="min-h-9 cursor-pointer whitespace-nowrap rounded-full border border-border bg-transparent px-3 py-2 text-xs text-text hover:border-red-500 hover:text-red-500"
            onClick={() => {
              if (confirm(`Remove ${profile.name} from the team? They'll lose access immediately.`)) {
                actions.removeTeammate(uid);
              }
            }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
