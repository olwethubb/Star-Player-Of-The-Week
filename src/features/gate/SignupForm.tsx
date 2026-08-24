import { useState, type FormEvent } from 'react';
import { signUp } from '@/services/auth.service';
import { friendlyError } from '@/lib/errors';
import { isValidPin } from '@/lib/auth-pin';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { GateBody, GateHeading, GateLink, GateLinks, GateShell } from './GateShell';

const SIGNUP_ERROR_MAP: Record<string, string> = {
  'auth/email-already-in-use': 'An account with that email already exists — try logging in instead.',
  'auth/invalid-email': 'That email address looks invalid.',
};

interface FirebaseAuthError {
  code?: string;
}

export function SignupForm({ onLogin, onBack }: { onLogin: () => void; onBack: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    if (!isValidPin(pin)) {
      setError('Your PIN must be exactly 4 digits.');
      return;
    }
    if (pin !== confirm) {
      setError("PINs don't match.");
      return;
    }
    setSubmitting(true);
    signUp(name.trim(), email.trim(), pin).catch((err: FirebaseAuthError) => {
      setSubmitting(false);
      setError(
        (err.code && SIGNUP_ERROR_MAP[err.code]) ||
          friendlyError(err, 'Could not create your account. Try again in a moment.'),
      );
    });
  }

  return (
    <GateShell
      brand={
        <>
          <GateHeading wide>Create your account</GateHeading>
          <GateBody>
            Sign up with your email and a 4-digit PIN. You'll need to verify your email before you can vote.
          </GateBody>
        </>
      }
    >
      {error && (
        <p role="alert" className="m-0 mb-4 rounded-xl border border-accent/40 bg-accent/5 px-3.5 py-2.5 text-[13px] text-text">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <Field label="Full name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Field
          label="Email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="4-digit PIN"
          isPassword
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="new-password"
          maxLength={4}
          required
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
        <Field
          label="Confirm PIN"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="new-password"
          maxLength={4}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
        <div className="mt-2">
          <Button type="submit" variant="gate" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Sign up'}
          </Button>
        </div>
      </form>
      <GateLinks>
        <GateLink onClick={onLogin}>Already have an account? Log in</GateLink>
        <GateLink subtle onClick={onBack}>
          ‹ Back
        </GateLink>
      </GateLinks>
    </GateShell>
  );
}
