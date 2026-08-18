import { deleteApp, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from './firebase';

/** Creates a new Firebase Auth user without signing the *current* admin out — done via a
 * throwaway secondary app instance, since the modular SDK's `auth` is bound to one app. */
export async function withSecondaryAuth<T>(fn: (secondaryAuth: ReturnType<typeof getAuth>) => Promise<T>): Promise<T> {
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  try {
    return await fn(getAuth(secondaryApp));
  } finally {
    await deleteApp(secondaryApp);
  }
}
