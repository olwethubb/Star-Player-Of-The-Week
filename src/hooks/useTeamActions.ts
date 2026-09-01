import { useCallback, useState } from 'react';
import * as profilesService from '@/services/profiles.service';
import { friendlyError } from '@/lib/errors';
import { useToast } from '@/hooks/useToast';

export function useTeamActions() {
  const { notify } = useToast();
  const [addingMember, setAddingMember] = useState(false);

  const renameTeammate = useCallback(
    (uid: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        notify("Name can't be empty.");
        return Promise.resolve();
      }
      return profilesService
        .renameTeammate(uid, trimmed)
        .catch((err) => notify(friendlyError(err, 'Could not rename them. Try again in a moment.')));
    },
    [notify],
  );

  const removeTeammate = useCallback(
    (uid: string) =>
      profilesService
        .removeTeammate(uid)
        .catch((err) => notify(friendlyError(err, 'Could not remove that teammate. Try again in a moment.'))),
    [notify],
  );

  const releaseClaimFor = useCallback(
    (uid: string) =>
      profilesService
        .releaseClaimFor(uid)
        .then(() => notify('Name freed up — they can claim it again on their device.', 'success'))
        .catch((err) => notify(friendlyError(err, 'Could not free up that name. Try again in a moment.'))),
    [notify],
  );

  const addTeammate = useCallback(
    async (name: string) => {
      setAddingMember(true);
      try {
        await profilesService.addTeammate(name);
        return true;
      } catch (err) {
        notify(friendlyError(err, 'Could not add them. Try again in a moment.'));
        return false;
      } finally {
        setAddingMember(false);
      }
    },
    [notify],
  );

  return { renameTeammate, removeTeammate, releaseClaimFor, addTeammate, addingMember };
}
