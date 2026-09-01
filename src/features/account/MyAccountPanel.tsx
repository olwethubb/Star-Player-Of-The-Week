import { useRef, useState } from 'react';
import { CollapsiblePanel } from '@/components/ui/CollapsiblePanel';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { setAvatar } from '@/services/profiles.service';
import { fileToAvatarDataUri } from '@/lib/avatar';
import { friendlyError } from '@/lib/errors';
import { useToast } from '@/hooks/useToast';
import { useSession } from '@/hooks/useSession';

/** All that's left of "my account" now there are no accounts — just your photo.
 * Switching to a different name lives in the top bar ("Not you?"). */
export function MyAccountPanel() {
  const { myUid, me } = useSession();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();

  async function handleFile(file: File | undefined) {
    if (!file || !myUid) return;
    setUploading(true);
    try {
      const dataUri = await fileToAvatarDataUri(file);
      await setAvatar(myUid, dataUri);
      notify('Photo updated.', 'success');
    } catch (err) {
      notify(friendlyError(err, 'Could not update your photo. Try again in a moment.'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (!me) return null;

  return (
    <CollapsiblePanel title="My photo">
      <div className="flex items-center gap-3">
        <Avatar name={me.name} avatarUrl={me.avatarUrl} />
        <Button variant="small" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? 'Uploading…' : me.avatarUrl ? 'Change photo' : 'Add photo'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </CollapsiblePanel>
  );
}
