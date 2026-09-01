/** Shared helpers for talking to the Firebase emulators over their REST APIs.
 * The `Bearer owner` header is the emulator's project-owner sentinel, which is what
 * lets seeding write docs that firestore.rules would (correctly) reject from a client. */
const PROJECT = 'star-player-of-the-week';
export const AUTH = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1`;
export const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const OWNER = { Authorization: 'Bearer owner' };
const KEY = 'fake-api-key';

export async function resetEmulators() {
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, {
    method: 'DELETE',
    headers: OWNER,
  });
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
    method: 'DELETE',
    headers: OWNER,
  });
}

/** The app has no accounts any more — a teammate is just a profile document, and a
 * uid is only ever a document id. Generated here rather than minted by Auth, so
 * seeding doesn't need the Auth emulator at all. */
export function fakeUid(name) {
  return `demo-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

/** Binds a roster name to a browser. Seeding one lets a screenshot run land straight
 * on the voting screen instead of the picker; seeding one for a name you then want to
 * appear as free would make it show up as "Taken". */
export function claimFor(authUid) {
  return { authUid, claimedAt: null };
}

function toFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out[k] = { stringValue: v };
    else if (typeof v === 'number') out[k] = { integerValue: String(v) };
    else if (typeof v === 'boolean') out[k] = { booleanValue: v };
    else if (v === null) out[k] = { nullValue: null };
    else if (Array.isArray(v)) out[k] = { arrayValue: { values: v.map((x) => ({ stringValue: x })) } };
  }
  return out;
}

export async function setDoc(path, data) {
  const res = await fetch(`${FS}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...OWNER },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`setDoc ${path}: ${await res.text()}`);
}

export async function getDoc(path) {
  const res = await fetch(`${FS}/${path}`, { headers: OWNER });
  if (!res.ok) return null;
  return res.json();
}

/** Must be TODAY'S week key, not a fixed string. The app computes its own key with
 * getWeekKey() and `castVote` stamps it onto sotw_voters/{uid}.weekKey, which
 * firestore.rules then requires to equal settings.currentWeek — so a hard-coded
 * DEMO_WEEK silently goes stale the moment the real week rolls over, every vote is
 * denied, and a screenshot run hangs waiting for a "Voted" button that never comes.
 *
 * Deliberately a copy of src/lib/week.ts rather than an import: these scripts are
 * plain .mjs run straight by node, with no TypeScript build step to pull that module
 * through. Keep the two in step — the Friday-to-Thursday offset especially. */
const BUSINESS_WEEK_OFFSET_DAYS = 4;

function isoWeek(now) {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
    );
  return { week, year: d.getUTCFullYear() };
}

export function getWeekKey(now = new Date()) {
  const shifted = new Date(now);
  shifted.setDate(shifted.getDate() - BUSINESS_WEEK_OFFSET_DAYS);
  const { week, year } = isoWeek(shifted);
  return `${year}-W${week}`;
}

export const DEMO_WEEK = getWeekKey();

export const DEMO_SETTINGS = {
  revealed: false,
  revealing: false,
  runoffUids: null,
  winnerUids: [],
  totalVotes: 0,
  votingOpen: true,
  currentWeek: DEMO_WEEK,
  weekPaused: false,
};
