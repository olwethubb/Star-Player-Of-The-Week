import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { setDoc } from 'firebase/firestore';
import { auth, balanceRef, profileRef } from '@/lib/firebase';
import { AppValidationError } from '@/lib/errors';

export function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

/** Self-signup: creates the auth account, their own profile (always role:'member' —
 * firestore.rules enforces that too, so this isn't just a client-side promise), an
 * empty balance doc, and sends the verification email. */
export async function signUp(name: string, email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
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
