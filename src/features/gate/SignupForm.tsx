import { useState, type FormEvent } from 'react';
import { signUp } from '@/services/auth.service';
import { friendlyError } from '@/lib/errors';
import { SIGNUP_EMAIL_DOMAIN } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { GateBody, GateHeading, GateLink, GateLogo, GateShell } from './GateShell';

const SIGNUP_ERROR_MAP: Record<string, string> = {
  'auth/email-already-in-use': 'An account with that email already exists — try logging in instead.',
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/weak-password': 'Choose a stronger password (at least 6 characters).',
};

interface FirebaseAuthError {
  code?: string;
}

export function SignupForm({ onLogin, onBack }: { onLogin: () => void; onBack: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    if (!email.toLowerCase().endsWith(SIGNUP_EMAIL_DOMAIN.toLowerCase())) {
      setError(`Use your ${SIGNUP_EMAIL_DOMAIN} email address.`);
      return;
    }
    if (password.length < 6) {
      setError('Password needs to be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    signUp(name.trim(), email.trim(), password).catch((err: FirebaseAuthError) => {
      setSubmitting(false);
      setError(
        (err.code && SIGNUP_ERROR_MAP[err.code]) ||
          friendlyError(err, 'Could not create your account. Try again in a moment.'),
      );
    });
  }

  return (
    <GateShell>
      <GateLogo />
      <GateHeading>Create your account</GateHeading>
      <GateBody>
        Sign up with your {SIGNUP_EMAIL_DOMAIN} email to vote. You'll need to verify it before you can vote.
      </GateBody>
      {error && <p className="mb-3.5 min-h-[1px] text-[13px] text-accent">{error}</p>}
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
          label="Password"
          isPassword
          autoComplete="new-password"
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Field
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <Button type="submit" variant="gate" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </Button>
      </form>
      <GateLink onClick={onLogin}>Already have an account? Log in</GateLink>
      <GateLink onClick={onBack}>‹ Back</GateLink>
    </GateShell>
  );
}
