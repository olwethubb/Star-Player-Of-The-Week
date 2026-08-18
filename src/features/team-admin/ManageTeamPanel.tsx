import { CollapsiblePanel } from '@/components/ui/CollapsiblePanel';
import { useTeamActions } from '@/hooks/useTeamActions';
import { MemberRow } from './MemberRow';
import { AddMemberForm } from './AddMemberForm';
import type { Profile } from '@/types/firestore';

interface ManageTeamPanelProps {
  profiles: Record<string, Profile>;
  balances: Record<string, number>;
  financeUid: string | null;
}

export function ManageTeamPanel({ profiles, balances, financeUid }: ManageTeamPanelProps) {
  const actions = useTeamActions(financeUid);
  const rows = Object.entries(profiles).sort((a, b) => a[1].name.localeCompare(b[1].name));

  return (
    <CollapsiblePanel title="Team & balances">
      {rows.length === 0 ? (
        <p className="text-[13px] text-text-muted">No teammates yet.</p>
      ) : (
        rows.map(([uid, profile]) => (
          <MemberRow
            key={uid}
            uid={uid}
            profile={profile}
            balance={balances[uid] || 0}
            holdsFinance={financeUid === uid}
            actions={actions}
          />
        ))
      )}
      <AddMemberForm actions={actions} />
    </CollapsiblePanel>
  );
}
