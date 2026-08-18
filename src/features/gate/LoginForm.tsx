import { useState, type FormEvent } from 'react';
import { forgotPassword, forgotPasswordErrorMessage, login } from '@/services/auth.service';
import { friendlyError } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useToast } from '@/hooks/useToast';
import { GateBody, GateHeading, GateLink, GateLogo, GateShell } from './GateShell';

const LOGIN_ERROR_MAP: Record<string, string> = {
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/user-disabled': 'This account has been disabled. Ask an admin.',
  'auth/too-many-requests': 'Too many attempts — wait a bit and try again.',
};

interface FirebaseAuthError {
  code?: string;
}

export function LoginForm({
  onSignup,
  onBack,
}: {
  onSignup: () => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { notify } = useToast();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Enter both your email and password.');
      return;
    }
    login(email, password).catch((err: FirebaseAuthError) => {
      setError(
        (err.code && LOGIN_ERROR_MAP[err.code]) || friendlyError(err, 'Could not log in. Try again in a moment.'),
      );
    });
  }

  function handleForgot() {
    try {
      forgotPassword(email.trim())
        .then(() => notify('Check your email for a password reset link.', 'success'))
        .catch((err: FirebaseAuthError) => {
          notify(
            forgotPasswordErrorMessage(err.code) ??
              friendlyError(err, 'Could not send the reset email. Try again in a moment.'),
          );
        });
    } catch (err) {
      notify(friendlyError(err, 'Enter your email above first, then click "Forgot password?" again.'));
    }
  }

  return (
    <GateShell>
      <GateLogo />
      <GateHeading>Sign in</GateHeading>
      <GateBody>Enter your email and password to vote.</GateBody>
      {error && <p className="mb-3.5 min-h-[1px] text-[13px] text-accent">{error}</p>}
      <form onSubmit={handleSubmit}>
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
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" variant="gate">
          Log in
        </Button>
      </form>
      <GateLink onClick={handleForgot}>Forgot password?</GateLink>
      <GateLink onClick={onSignup}>New here? Create an account</GateLink>
      <GateLink onClick={onBack}>‹ Back</GateLink>
    </GateShell>
  );
}
