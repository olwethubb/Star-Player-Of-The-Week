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

export async function signUp(email, password) {
  const res = await fetch(`${AUTH}/accounts:signUp?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`signUp ${email}: ${JSON.stringify(body)}`);
  return body.localId;
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

export const DEMO_SETTINGS = {
  revealed: false,
  revealing: false,
  bonusAwardedUids: [],
  winnerUids: [],
  totalVotes: 0,
  financeUid: null,
  votingOpen: true,
  currentWeek: '2026-W34',
};
