import { useCallback, useState } from 'react';
import * as profilesService from '@/services/profiles.service';
import * as balancesService from '@/services/balances.service';
import { friendlyError } from '@/lib/errors';
import { useToast } from '@/hooks/useToast';
import type { Role } from '@/types/firestore';

export function useTeamActions(currentFinanceUid: string | null) {
  const { notify } = useToast();
  const [addingMember, setAddingMember] = useState(false);

  const updateBalance = useCallback(
    (uid: string, value: string) => {
      const n = Number(value);
      if (Number.isNaN(n)) return;
      balancesService
        .updateBalance(uid, n)
        .catch((err) => notify(friendlyError(err, 'Could not update that balance. Try again in a moment.')));
    },
    [notify],
  );

  const setRole = useCallback(
    (uid: string, nextRole: Role) =>
      profilesService
        .setRole(uid, nextRole)
        .catch((err) => notify(friendlyError(err, 'Could not update their role. Try again in a moment.'))),
    [notify],
  );

  const setFinanceHolder = useCallback(
    (uid: string) =>
      profilesService
        .setFinanceHolder(currentFinanceUid, uid)
        .catch((err) => notify(friendlyError(err, 'Could not update the finance holder. Try again in a moment.'))),
    [currentFinanceUid, notify],
  );

  const removeTeammate = useCallback(
    (uid: string) =>
      profilesService
        .removeTeammate(uid)
        .catch((err) => notify(friendlyError(err, 'Could not remove that teammate. Try again in a moment.'))),
    [notify],
  );

  const addMember = useCallback(
    async (name: string, email: string, password: string, role: Role) => {
      if (!name || !email || !password) {
        notify('Fill in name, email and a temporary password first.');
        return false;
      }
      if (password.length < 6) {
        notify('Password needs to be at least 6 characters.');
        return false;
      }
      setAddingMember(true);
      try {
        await profilesService.createTeamMember(name, email, password, role);
        return true;
      } catch (err) {
        notify(friendlyError(err, 'Could not add that teammate. Try again in a moment.'));
        return false;
      } finally {
        setAddingMember(false);
      }
    },
    [notify],
  );

  return { updateBalance, setRole, setFinanceHolder, removeTeammate, addMember, addingMember };
}
