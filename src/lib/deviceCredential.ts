// The Credential Management API — supported by Chrome/Edge/Safari, not Firefox.
// Everything here is best-effort progressive enhancement: on a supported platform
// (e.g. Android Chrome, macOS/iOS Safari), the browser's own native prompt to save
// a credential appears after login, and retrieving it later is gated by the
// device's own Face/Touch ID or lock-screen unlock — without this app ever touching
// biometric data itself, or needing a backend to verify a WebAuthn ceremony. Where
// it's not supported, every function here just no-ops and normal login is unaffected.

interface StoredCredential {
  email: string;
  secret: string;
}

function supported(): boolean {
  return typeof window !== 'undefined' && 'PasswordCredential' in window && !!navigator.credentials;
}

/** Call right after a successful login or signup. Triggers the browser's native
 * "save this password?" prompt on supported platforms. */
export async function rememberCredential(email: string, secret: string, name: string): Promise<void> {
  if (!supported()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PasswordCredentialCtor = (window as any).PasswordCredential;
    const cred = new PasswordCredentialCtor({ id: email, password: secret, name });
    await navigator.credentials.store(cred);
  } catch {
    // Best-effort — a declined or unsupported save must never block login/signup.
  }
}

/** Call on the logged-out landing screen. `mediation: 'optional'` means it won't
 * interrupt with a picker unless there's exactly one saved credential to silently
 * hand back — that's the moment a supported device's Face/Touch ID gate kicks in. */
export async function getRememberedCredential(): Promise<StoredCredential | null> {
  if (!supported()) return null;
  try {
    // `password` and `mediation` are real, widely-supported Credential Management
    // API options that TS's base CredentialRequestOptions type doesn't know about.
    const options = { password: true, mediation: 'optional' } as CredentialRequestOptions;
    const cred = await navigator.credentials.get(options);
    if (cred && cred.type === 'password') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pc = cred as any;
      if (pc.id && pc.password) return { email: pc.id, secret: pc.password };
    }
  } catch {
    // Ignore — falls back to the normal login form.
  }
  return null;
}
