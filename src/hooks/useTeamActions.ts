import { useCallback, useState } from 'react';
import * as profilesService from '@/services/profiles.service';
import * as balancesService from '@/services/balances.service';
import { friendlyError } from '@/lib/errors';
import { isValidPin } from '@/lib/auth-pin';
import { useToast } from '@/hooks/useToast';
import type { Role } from '@/types/firestore';

interface FirebaseAuthError {
  code?: string;
}

const ADD_MEMBER_ERROR_MAP: Record<string, string> = {
  'auth/email-already-in-use': 'That email already has an account — remove it first, or use a different email.',
  'auth/invalid-email': 'That email address looks invalid.',
};

export function useTeamActions(actingUid: string) {
  const { notify } = useToast();
  const [addingMember, setAddingMember] = useState(false);

  const updateBalance = useCallback(
    (uid: string, value: string, from: number) => {
      // Number('') is 0, not NaN — without the trim/empty check, clearing the
      // field and blurring would silently zero out someone's balance.
      if (value.trim() === '') return;
      const n = Number(value);
      if (Number.isNaN(n) || !Number.isInteger(n) || n < 0) return;
      balancesService
        .updateBalance(uid, n, from, actingUid)
        .catch((err) => notify(friendlyError(err, 'Could not update that balance. Try again in a moment.')));
    },
    [actingUid, notify],
  );

  const renameTeammate = useCallback(
    (uid: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        notify('Name can\'t be empty.');
        return Promise.resolve();
      }
      return profilesService
        .renameTeammate(uid, trimmed)
        .catch((err) => notify(friendlyError(err, 'Could not rename them. Try again in a moment.')));
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

  const assignFinanceHolder = useCallback(
    (uid: string) =>
      profilesService
        .assignFinanceHolder(uid)
        .catch((err) => notify(friendlyError(err, 'Could not update the finance holder. Try again in a moment.'))),
    [notify],
  );

  const clearFinanceHolder = useCallback(
    () =>
      profilesService
        .clearFinanceHolder()
        .catch((err) => notify(friendlyError(err, 'Could not update the finance holder. Try again in a moment.'))),
    [notify],
  );

  const removeTeammate = useCallback(
    (uid: string) =>
      profilesService
        .removeTeammate(uid)
        .catch((err) => notify(friendlyError(err, 'Could not remove that teammate. Try again in a moment.'))),
    [notify],
  );

  const addMember = useCallback(
    async (name: string, email: string, pin: string, role: Role) => {
      if (!name || !email || !pin) {
        notify('Fill in name, email and a 4-digit PIN first.');
        return false;
      }
      if (!isValidPin(pin)) {
        notify('PIN must be exactly 4 digits.');
        return false;
      }
      setAddingMember(true);
      try {
        await profilesService.createTeamMember(name, email, pin, role);
        return true;
      } catch (err) {
        const code = (err as FirebaseAuthError).code;
        notify((code && ADD_MEMBER_ERROR_MAP[code]) || friendlyError(err, 'Could not add that teammate. Try again in a moment.'));
        return false;
      } finally {
        setAddingMember(false);
      }
    },
    [notify],
  );

  return {
    updateBalance,
    renameTeammate,
    setRole,
    assignFinanceHolder,
    clearFinanceHolder,
    removeTeammate,
    addMember,
    addingMember,
  };
}
