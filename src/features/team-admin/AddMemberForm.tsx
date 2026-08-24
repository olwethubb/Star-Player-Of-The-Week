import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useTeamActions } from '@/hooks/useTeamActions';
import type { Role } from '@/types/firestore';

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

const selectClass =
  'w-full rounded-xl border border-border bg-bg-elevated px-3.5 py-3 text-base text-text transition-colors focus:border-accent focus:outline-none';

export function AddMemberForm({ actions }: { actions: ReturnType<typeof useTeamActions> }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<Role>('member');

  async function handleAdd() {
    const ok = await actions.addMember(name.trim(), email.trim(), pin, role);
    if (ok) {
      setName('');
      setEmail('');
      setPin('');
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-1 border-t border-border-soft pt-4">
      <Field label="Full name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
      <Field
        label="Email address"
        type="email"
        autoCapitalize="none"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field
            label="4-digit PIN"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </div>
        <Button variant="small" className="mb-3.5" onClick={() => setPin(generatePin())}>
          Generate
        </Button>
      </div>
      <div className="mb-3.5 flex gap-2">
        <select className={selectClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <Button variant="ghost" className="min-w-[110px]" disabled={actions.addingMember} onClick={handleAdd}>
          {actions.addingMember ? 'Adding…' : 'Add'}
        </Button>
      </div>
      <p className="-mt-2 text-xs text-text-muted">
        Share the PIN with them directly — that's what they'll type in to log in and vote.
      </p>
    </div>
  );
}
