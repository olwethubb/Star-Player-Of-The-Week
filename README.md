# Blacfox — Star Player of the Week

React + TypeScript + Vite app, backed by the existing Firebase project
(`star-player-of-the-week`) — Firestore holds the roster and the session, and
`firestore.rules` is the only thing standing between the database and the
open internet.

It does one thing: run the weekly vote. No accounts, no sign-in of any kind
(not even an invisible one), no roles, no money.

## Setup

```bash
npm install
cp .env.example .env.local   # already pre-filled with the real (public) Firebase config below if present
npm run dev
```

One thing must be done in the Firebase console, or the app never gets past
its loading spinner: **`firestore.rules` must be published** — Build →
Firestore Database → Rules → paste the file → Publish. A fresh project starts
blocking everything, and this app has no other way past that (there's no
account to log into that would let you fix it from inside the app).

Nothing else needs the console. The roster itself — including the first
profile named `KG` — is set up from inside the app: an empty roster shows a
one-time **"I'll be KG and add the team"** button on the name picker instead
of a list of names. Tapping it creates that profile and claims it in one
step. From then on, adding everyone else happens in-app from
**Team → Add someone**.

The `.env.local` values are the same public Firebase web config (`apiKey`,
`authDomain`, etc.) the old single-file `legacy/index.html` had hardcoded —
not secrets, just moved out of source per normal practice. That file is no
longer in this repo (it went with the rewrite); the copy still embedded in
Landingi is the only one left. If you're setting this up fresh, copy the
values from Firebase console → Project settings → General → Your apps → SDK
setup and configuration.

## How you get in

There is no sign-in screen, and no sign-in of any kind behind it either — no
email, no password, no PIN, no signup, not even the invisible anonymous-auth
kind. You open the app, pick your name from the dropdown, and you're voting. Which
name you've claimed is remembered by your own browser
(`src/lib/localIdentity.ts`, plain `localStorage`) — there's no account behind
it, and nothing server-side ties a name to the person tapping it.

**One name, one browser — as a convention, not a guarantee.** Tapping your
name writes a claim (`sotw_claims/{uid}`), and that document is create-only,
so two taps landing on the *same* name at the *same* moment can't both win —
the database genuinely enforces that much. What it can't enforce is that the
tap belongs to the right person: nothing stops a second browser from claiming
a *different* already-taken name by going around the app's own UI. That trade
was made on purpose once there was nothing left in the app worth gating behind
real identity. If you clear your site data or switch phones, your name is
stuck on the browser that claimed it — the host frees it from
**Team → Free up name**, then you can take it again.

**KG runs the session — same trade.** Whoever's browser has claimed the
profile named `KG` sees the host controls: open/close voting, pause a week,
run the reveal. The app's UI decides this purely by checking the locally
remembered name, so the roster **needs a profile called KG** or nobody sees
those controls at all — and, same as above, the database doesn't verify who's
allowed to be the one who tapped it.

## Who voted for whom is never recorded

There is no ballot to read. Your pick is written to your own browser's
localStorage (`src/lib/localPick.ts`) and is never sent anywhere: the app tells
the server only that *you voted* (`sotw_voters/{uid}` — a week key and a
timestamp, nothing else) and that *someone's count went up* (`sotw_tally/{uid}`,
nudged by exactly ±1), never the link between the two. So there is no collection
anyone reading the raw database could join to get from a vote back to a voter —
the mapping was never stored, not merely hidden. This is the one guarantee in
this app that has nothing to do with identity, so dropping sign-in entirely
didn't weaken it at all: the counts are unreadable by anyone while voting is
open (not just by KG — the rule doesn't check who's asking, only whether
voting is closed), because watching a live count move is itself a way to
infer who just voted for whom, no matter who's watching.

`sotw_voters` also clamps its own shape (`keys().hasOnly(['weekKey', 'ts'])`),
so this isn't just a convention the app's own client happens to follow — a
hand-rolled or patched client can't smuggle a `votedForUid` field into that
document either. The rule is what makes the promise true, not the UI.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run typecheck` | `tsc -b`, no emit to `dist/` — covers `src` **and** `e2e`, so the Playwright spec can't rot unnoticed |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm test` | Vitest unit tests (pure logic — week math, winner computation, streaks, error mapping) |
| `npm run test:rules` | Firestore Rules Emulator tests — spins up a local emulator and runs the whole of `firestore.rules` against it: a claimed name can't be re-claimed or repointed to someone else, a voter marker can never carry who was voted for, the tally moves by ±1 and only for someone who's 'up' this week, and it's unreadable by anyone while voting is open. Needs Java (the emulator runs on it) and no other process on port 8080. |
| `npm run e2e` | Playwright smoke test against a running dev server — boots the app and checks the name picker renders, no seeded data needed |

## Deploying

Live at the project's default `*.web.app` URL — the old Landingi-embedded
`legacy/index.html` was confirmed dead before this cut over, so there was no
separate migration sequencing needed.

```bash
firebase login          # needs your own interactive OAuth, once per machine
npm run build
firebase deploy --only hosting,firestore:rules
```

Both together is intentional now: with no accounts to preserve, there's no
reason to publish rules separately from the app that depends on them — a
mismatch between the two just breaks the app until the next deploy fixes it.

## App Check (optional, recommended)

Not wired to anything live yet — the client code supports it, but it needs a
reCAPTCHA v3 site key from *your* Google/Firebase console, which nobody else
can create on your behalf:

1. Firebase console → Build → App Check → register this web app → reCAPTCHA v3 → copy the site key.
2. Set `VITE_RECAPTCHA_SITE_KEY` in `.env.local` (and in your Hosting deploy's build env).
3. In App Check → APIs, turn on enforcement for Firestore **only after** confirming real traffic is passing (App Check has a monitoring-only mode first — use it before enforcing, or you can lock yourself out).

Leaving `VITE_RECAPTCHA_SITE_KEY` unset is safe — App Check simply doesn't activate.

## What's intentionally not here

Two testing-only features from the legacy app were dropped outright rather
than ported, per an explicit decision made during the rewrite: a fake
"winner" invented when zero real votes were cast, and a hidden control to
manually override which calendar week it "is". Both are replaced by the test
suite above — see `src/rules/firestore.rules.test.ts` and
`src/lib/week.test.ts` if you need to exercise similar scenarios locally.
