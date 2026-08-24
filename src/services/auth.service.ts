import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth';
import { setDoc } from 'firebase/firestore';
import { auth, balanceRef, profileRef } from '@/lib/firebase';
import { AppValidationError } from '@/lib/errors';
import { isValidPin, pinToPassword, resolveLoginSecret } from '@/lib/auth-pin';

/** `secret` is whatever the field held — an existing account's real password, or a
 * PIN-based account's 4-digit PIN. resolveLoginSecret tells them apart. */
export function login(email: string, secret: string) {
  return signInWithEmailAndPassword(auth, email, resolveLoginSecret(secret));
}

export function logout() {
  return signOut(auth);
}

/** Self-signup: creates the auth account, their own profile (always role:'member' —
 * firestore.rules enforces that too, so this isn't just a client-side promise), an
 * empty balance doc, and sends the verification email. Every account created this
 * way is PIN-based — see pinToPassword for why that's what's actually stored. */
export async function signUp(name: string, email: string, pin: string) {
  if (!isValidPin(pin)) {
    throw new AppValidationError('Your PIN must be exactly 4 digits.');
  }
  const cred = await createUserWithEmailAndPassword(auth, email, pinToPassword(pin));
  const uid = cred.user.uid;
  await Promise.all([
    setDoc(profileRef(uid), { name, email, role: 'member', selfSignup: true }),
    setDoc(balanceRef(uid), { balance: 0 }),
    sendEmailVerification(cred.user),
  ]);
}

export function resendVerificationEmail(user: User) {
  return sendEmailVerification(user);
}

/** Lets anyone already signed in switch to (or change) a 4-digit PIN themselves,
 * without the "reset your password" page's manual doubling trick — this pads it
 * the same way signUp/createTeamMember do. Firebase requires a "recent" login for
 * this; a long-since-signed-in session throws auth/requires-recent-login, which
 * the caller should turn into "log out and back in, then try again" rather than
 * the generic error. */
export function changeMyPin(pin: string) {
  if (!isValidPin(pin)) {
    throw new AppValidationError('Your PIN must be exactly 4 digits.');
  }
  if (!auth.currentUser) {
    throw new AppValidationError('You need to be signed in to do this.');
  }
  return updatePassword(auth.currentUser, pinToPassword(pin));
}

export function forgotPassword(email: string) {
  if (!email) {
    throw new AppValidationError('Enter your email above first, then click "Forgot password?" again.');
  }
  return sendPasswordResetEmail(auth, email);
}

const FORGOT_PASSWORD_ERROR_MAP: Record<string, string> = {
  'auth/invalid-email': 'That email address looks invalid.',
  // Don't reveal whether the account exists either way.
  'auth/user-not-found': 'Check your email for a password reset link.',
};

export function forgotPasswordErrorMessage(code: string | undefined): string | undefined {
  return code ? FORGOT_PASSWORD_ERROR_MAP[code] : undefined;
}
