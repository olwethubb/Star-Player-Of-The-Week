import { useState } from 'react';
import { useTeamActions } from '@/hooks/useTeamActions';
import type { Role } from '@/types/firestore';

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

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

  const inputClass =
    'min-h-11 min-w-0 flex-1 rounded-[10px] border border-border bg-bg-card px-3 py-2.5 text-base text-text focus:border-accent focus:outline-none';

  return (
    <div className="mt-4 flex flex-col gap-2.5 border-t border-border-soft pt-4">
      <input className={inputClass} type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
      <input
        className={inputClass}
        type="email"
        placeholder="Email address"
        autoCapitalize="none"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="flex gap-2">
        <input
          className={inputClass}
          type="text"
          placeholder="Temporary password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="button"
          className="cursor-pointer rounded-[10px] border border-border bg-bg-card px-3 text-[13px] text-text"
          onClick={() => setPassword(generatePassword())}
        >
          Generate
        </button>
      </div>
      <div className="flex gap-2">
        <select
          className={inputClass}
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="button"
          disabled={actions.addingMember}
          onClick={handleAdd}
          className="min-h-[46px] min-w-[110px] cursor-pointer rounded-full border border-border bg-transparent px-5 text-sm font-semibold text-text hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {actions.addingMember ? 'Adding…' : 'Add'}
        </button>
      </div>
      <p className="-mt-0.5 text-xs text-text-muted">
        Share the temporary password with them directly. They can reset it anytime from the login screen.
      </p>
    </div>
  );
}
