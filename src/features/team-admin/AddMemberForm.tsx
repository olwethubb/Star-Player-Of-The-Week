import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useTeamActions } from '@/hooks/useTeamActions';
import type { Role } from '@/types/firestore';

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const selectClass =
  'w-full rounded-xl border border-border bg-bg-elevated px-3.5 py-3 text-base text-text transition-colors focus:border-accent focus:outline-none';

export function AddMemberForm({ actions }: { actions: ReturnType<typeof useTeamActions> }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('member');

  async function handleAdd() {
    const ok = await actions.addMember(name.trim(), email.trim(), password, role);
    if (ok) {
      setName('');
      setEmail('');
      setPassword('');
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
          <Field label="Temporary password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button variant="small" className="mb-3.5" onClick={() => setPassword(generatePassword())}>
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
        Share the temporary password with them directly. They can reset it anytime from the login screen.
      </p>
    </div>
  );
}
