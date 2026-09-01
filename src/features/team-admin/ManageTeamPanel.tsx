import { useState } from 'react';
import { CollapsiblePanel } from '@/components/ui/CollapsiblePanel';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useTeamActions } from '@/hooks/useTeamActions';
import { useSession } from '@/hooks/useSession';
import { HOST_NAME, isHostName } from '@/types/firestore';
import { MemberRow } from './MemberRow';

function AddMemberForm({ actions }: { actions: ReturnType<typeof useTeamActions> }) {
  const [name, setName] = useState('');

  async function handleAdd() {
    const ok = await actions.addTeammate(name);
    if (ok) setName('');
  }

  return (
    <div className="mt-4 flex flex-col gap-1 border-t border-border-soft pt-4">
      <Field
        label="Add someone"
        type="text"
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd();
        }}
      />
      <Button variant="ghost" disabled={actions.addingMember} onClick={handleAdd}>
        {actions.addingMember ? 'Adding…' : 'Add to roster'}
      </Button>
      <p className="mt-2 text-xs leading-relaxed text-text-muted">
        That's all it takes — no email, no password. They open the app and tap their name.
      </p>
    </div>
  );
}

export function ManageTeamPanel() {
  const { profiles, claims, myUid } = useSession();
  const actions = useTeamActions();
  const rows = Object.entries(profiles).sort((a, b) => a[1].name.localeCompare(b[1].name));
  const hasHost = rows.some(([, p]) => isHostName(p.name));

  return (
    <CollapsiblePanel title="Team">
      {!hasHost && (
        <p className="mb-3.5 rounded-xl border border-accent/40 bg-accent/5 px-3.5 py-2.5 text-[13px] leading-relaxed">
          Nobody on the roster is called <b>{HOST_NAME}</b>. Whoever claims that name runs the session — opens and
          closes voting, and sees the totals. Add or rename someone to {HOST_NAME} to hand over these controls.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-[13px] text-text-muted">Nobody on the roster yet.</p>
      ) : (
        rows.map(([uid, profile]) => (
          <MemberRow
            key={uid}
            uid={uid}
            profile={profile}
            claimed={!!claims[uid]}
            isMe={uid === myUid}
            actions={actions}
          />
        ))
      )}
      <AddMemberForm actions={actions} />
    </CollapsiblePanel>
  );
}
