import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
  type FirestoreDataConverter,
} from 'firebase/firestore';
import type { Balance, BalanceAdjustment, MyVote, Payout, PayoutRequest, Profile, Settings, Tally } from '@/types/firestore';

function requiredEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing required env var ${key} — check .env.local (see .env.example)`);
  }
  return value;
}

export const firebaseConfig = {
  apiKey: requiredEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requiredEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requiredEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requiredEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requiredEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requiredEnv('VITE_FIREBASE_APP_ID'),
};

export const app = initializeApp(firebaseConfig);

// App Check is optional and only activates once VITE_RECAPTCHA_SITE_KEY is set — it
// requires enforcement to also be turned on for Firestore in the Firebase console
// (App Check → APIs), so leaving it unset must not break the app for anyone who
// hasn't done that yet. See README.md for how to set one up.
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (recaptchaSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const db = getFirestore(app);

// A converter that passes data through as-is, typed. Every doc read this way is
// trusted to already match its type — firestore.rules is what actually enforces shape.
function passthrough<T>(): FirestoreDataConverter<T> {
  return {
    toFirestore: (data) => data as Record<string, unknown>,
    fromFirestore: (snap) => snap.data() as T,
  };
}

function col<T>(path: string): CollectionReference<T> {
  return collection(db, path).withConverter(passthrough<T>());
}

export const profilesCol = col<Profile>('sotw_profiles');
export const balancesCol = col<Balance>('sotw_balances');
export const myVoteCol = col<MyVote>('sotw_myvote');
export const tallyCol = col<Tally>('sotw_tally');
export const payoutRequestsCol = col<PayoutRequest>('sotw_payout_requests');
export const payoutsCol = col<Payout>('sotw_payouts');
export const balanceAdjustmentsCol = col<BalanceAdjustment>('sotw_balance_adjustments');

export const settingsRef: DocumentReference<Settings> = doc(db, 'sotw_meta', 'settings').withConverter(
  passthrough<Settings>(),
);

export function profileRef(uid: string): DocumentReference<Profile> {
  return doc(profilesCol, uid);
}
export function balanceRef(uid: string): DocumentReference<Balance> {
  return doc(balancesCol, uid);
}
export function myVoteRef(uid: string): DocumentReference<MyVote> {
  return doc(myVoteCol, uid);
}
export function tallyRef(uid: string): DocumentReference<Tally> {
  return doc(tallyCol, uid);
}
