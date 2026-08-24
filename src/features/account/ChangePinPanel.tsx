import { useState } from 'react';
import { CollapsiblePanel } from '@/components/ui/CollapsiblePanel';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { changeMyPin } from '@/services/auth.service';
import { isValidPin } from '@/lib/auth-pin';
import { friendlyError } from '@/lib/errors';
import { useToast } from '@/hooks/useToast';

interface FirebaseAuthError {
  code?: string;
}

const REAUTH_MESSAGE = "For your security, log out and back in, then try setting your PIN again.";

export function ChangePinPanel() {
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
    <CollapsiblePanel title="Change my PIN">
      <p className="mb-3.5 text-[13px] text-text-muted">
        This is what you type in to log in and vote — no need to remember a separate password.
      </p>
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
    </CollapsiblePanel>
  );
}
