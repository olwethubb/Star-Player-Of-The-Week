import { useRef, useState } from 'react';
import { CollapsiblePanel } from '@/components/ui/CollapsiblePanel';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { changeMyPin } from '@/services/auth.service';
import { setAvatar } from '@/services/profiles.service';
import { fileToAvatarDataUri } from '@/lib/avatar';
import { isValidPin, pinToPassword } from '@/lib/auth-pin';
import { rememberCredential } from '@/lib/deviceCredential';
import { friendlyError } from '@/lib/errors';
import { useToast } from '@/hooks/useToast';
import { useSession } from '@/hooks/useSession';

interface FirebaseAuthError {
  code?: string;
}

const REAUTH_MESSAGE = "For your security, log out and back in, then try setting your PIN again.";

function AvatarUpload() {
  const { user, me } = useSession();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();

  async function handleFile(file: File | undefined) {
    if (!file || !user) return;
    setUploading(true);
    try {
      const dataUri = await fileToAvatarDataUri(file);
      await setAvatar(user.uid, dataUri);
      notify('Photo updated.', 'success');
    } catch (err) {
      notify(friendlyError(err, 'Could not update your photo. Try again in a moment.'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (!user || !me) return null;

  return (
    <div className="mb-4 flex items-center gap-3">
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
  );
}

function PinChange() {
  const { me } = useSession();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  async function handleSave() {
    if (!isValidPin(pin)) {
      notify('Your PIN must be exactly 4 digits.');
      return;
    }
    if (pin !== confirm) {
      notify("PINs don't match.");
      return;
    }
    setSaving(true);
    try {
      await changeMyPin(pin);
      if (me) rememberCredential(me.email, pinToPassword(pin), me.email).catch(() => {});
      notify('PIN updated.', 'success');
      setPin('');
      setConfirm('');
    } catch (err) {
      const code = (err as FirebaseAuthError).code;
      notify(
        code === 'auth/requires-recent-login'
          ? REAUTH_MESSAGE
          : friendlyError(err, 'Could not update your PIN. Try again in a moment.'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Field
        label="New 4-digit PIN"
        isPassword
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        autoComplete="new-password"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
      />
      <Field
        label="Confirm PIN"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
      />
      <Button variant="ghost" disabled={saving} onClick={handleSave}>
        {saving ? 'Saving…' : 'Save PIN'}
      </Button>
    </>
  );
}

export function MyAccountPanel() {
  return (
    <CollapsiblePanel title="My account">
      <AvatarUpload />
      <p className="mb-3.5 text-[13px] text-text-muted">
        Your PIN is what you type in to log in and vote — no need to remember a separate password.
      </p>
      <PinChange />
    </CollapsiblePanel>
  );
}
