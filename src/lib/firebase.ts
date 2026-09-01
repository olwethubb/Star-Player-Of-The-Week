import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  connectFirestoreEmulator,
  getFirestore,
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
  type FirestoreDataConverter,
} from 'firebase/firestore';
import type { Claim, Profile, Settings, StatDeclaration, Tally, Voter, WeeklyActivity } from '@/types/firestore';

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

/** Set VITE_USE_EMULATORS=1 to point a local dev server at the Firebase emulators
 * instead of the real project — needed to work on screens whose data doesn't exist
 * in production right now (an open vote, a revealed week) without mutating real
 * votes to get there. Never set in a deployed build. */
const useEmulators = import.meta.env.VITE_USE_EMULATORS === '1';

// App Check is optional and only activates once VITE_RECAPTCHA_SITE_KEY is set — it
// requires enforcement to also be turned on for Firestore in the Firebase console
// (App Check → APIs), so leaving it unset must not break the app for anyone who
// hasn't done that yet. See README.md for how to set one up.
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (recaptchaSiteKey && !useEmulators) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

// No Firebase Auth of any kind — not even the invisible anonymous variety. There's
// nothing left in this app worth gating behind an identity the database can verify
// (see Claim in types/firestore.ts), so firestore.rules doesn't check request.auth
// at all, and there's no console setup step beyond publishing those rules.
export const db = getFirestore(app);

if (useEmulators) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

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
export const claimsCol = col<Claim>('sotw_claims');
export const tallyCol = col<Tally>('sotw_tally');
export const votersCol = col<Voter>('sotw_voters');
export const statStatusCol = col<StatDeclaration>('sotw_stat_status');
export const weeklyActivityCol = col<WeeklyActivity>('sotw_weekly_activity');

export const settingsRef: DocumentReference<Settings> = doc(db, 'sotw_meta', 'settings').withConverter(
  passthrough<Settings>(),
);

export function profileRef(uid: string): DocumentReference<Profile> {
  return doc(profilesCol, uid);
}
export function claimRef(uid: string): DocumentReference<Claim> {
  return doc(claimsCol, uid);
}
export function tallyRef(uid: string): DocumentReference<Tally> {
  return doc(tallyCol, uid);
}
export function voterRef(uid: string): DocumentReference<Voter> {
  return doc(votersCol, uid);
}
export function statStatusRef(uid: string): DocumentReference<StatDeclaration> {
  return doc(statStatusCol, uid);
}
export function weeklyActivityRef(weekKey: string, uid: string): DocumentReference<WeeklyActivity> {
  return doc(weeklyActivityCol, `${weekKey}_${uid}`);
}
