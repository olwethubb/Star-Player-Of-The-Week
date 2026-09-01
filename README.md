# Blacfox — Star Player of the Week

React + TypeScript + Vite app, backed by the existing Firebase project
(`star-player-of-the-week`) — Firestore holds the roster and the session,
anonymous Auth gives each browser an identity, and `firestore.rules` is what
actually enforces the two promises the app makes: **one name, one person**, and
**the host sees counts, never ballots**.

It does one thing: run the weekly vote. No accounts, no roles, no money.

## Setup

```bash
npm install
cp .env.example .env.local   # already pre-filled with the real (public) Firebase config below if present
npm run dev
```

Two things must be done in the Firebase console, or the app never gets past
its loading spinner:

1. **Anonymous sign-in must be enabled** — Build → Authentication → Sign-in
   method → Anonymous → Enable. Every browser is signed in anonymously on load;
   without it nobody gets a uid, every read is denied and no name can be
   claimed. This is the first thing to check when "it doesn't load".
2. **`firestore.rules` must be published** — Build → Firestore Database →
   Rules → paste the file → Publish. A fresh project starts blocking
   everything.

Nothing else needs the console. The roster itself — including the first
profile named `KG` — is set up from inside the app: an empty roster shows a
one-time **"I'll be KG and add the team"** button on the name picker instead of
a list of names. `firestore.rules` opens a narrow bootstrap exception for
exactly this (any signed-in browser may create ONLY a profile shaped
`{ name: 'KG' }`, and only while no host is registered yet); tapping the
button creates that profile and claims it in one step, which immediately makes
that browser the host and closes the exception for good. From then on, adding
everyone else happens in-app from **Team → Add someone**.

The `.env.local` values are the same public Firebase web config (`apiKey`,
`authDomain`, etc.) the old single-file `legacy/index.html` had hardcoded —
not secrets, just moved out of source per normal practice. That file is no
longer in this repo (it went with the rewrite); the copy still embedded in
Landingi is the only one left. If you're setting this up fresh, copy the
values from Firebase console → Project settings → General → Your apps → SDK
setup and configuration.

## How you get in

There is no sign-in screen: no email, no password, no PIN, no signup. You open
the app, tap your name on the roster, and you're voting. The anonymous sign-in
above happens silently — nobody sees it and there is nothing to type. Its only
job is to give each browser a stable uid the security rules can check.

**One name, one browser.** Tapping your name writes a claim
(`sotw_claims/{uid}`), and that document is create-only, so the first browser
to take a name owns it and it reads as *Taken* to everyone else. That's the
database enforcing it, not the UI greying out a button. If you clear your site
data or switch phones, your name is stuck on the browser that claimed it — the
host frees it from **Team → Free up name**, then you can take it again.

**KG runs the session.** Whoever claims the profile named `KG` is the host:
they open and close voting, pause a week, and run the reveal — and they don't
vote themselves. It's the roster name that decides this, not a flag on an
account, so the roster **needs a profile called KG** or nobody can run a
session at all.

## Who voted for whom is never recorded

There is no ballot to read. Your pick is written to your own browser's
localStorage (`src/lib/localPick.ts`) and is never sent anywhere: the app tells
the server only that *you voted* (`sotw_voters/{uid}` — a week key and a
timestamp, nothing else) and that *someone's count went up* (`sotw_tally/{uid}`,
nudged by exactly ±1), never the link between the two. So there is no collection
a host, or anyone reading the raw database, could join to get from a vote back to
a voter — the mapping was never stored, not merely hidden. The counts themselves
are host-readable only, and only once voting has closed, because watching a live
count move is itself a way to infer who just voted for whom.

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
| `npm run test:rules` | Firestore Rules Emulator tests — spins up a local emulator and runs the whole of `firestore.rules` against it: a claimed name can't be re-claimed or repointed, only the KG claim-holder can register as host, the bootstrap exception on an empty roster accepts nothing but `{ name: 'KG' }` and closes once a host exists, the tally moves by ±1 and only for someone who's 'up' this week, and it's readable by the host alone and only after voting closes. Needs Java (the emulator runs on it) and no other process on port 8080. |
| `npm run e2e` | Playwright smoke test against a running dev server — boots the app and checks the name picker renders, no seeded data needed |

## Deploying

This repo is wired for Firebase Hosting but **has not been deployed yet** —
that needs your own Firebase login, which an agent session can't complete
(it's an interactive OAuth flow):

```bash
firebase login
npm run build
firebase deploy --only hosting
```

Always pass `--only hosting`. `firestore.rules` is published by hand in the
console (see Setup) — never let a hosting deploy touch it.

This deploys to the project's default `*.web.app` URL, which doesn't affect
anyone still using the Landingi-embedded `legacy/index.html` — see the
"Migration sequencing" section of the plan this was built from
(`async-greeting-lake.md`, saved to your Claude Code plans folder) for the
recommended dogfood → announce → retire-Landingi cutover sequence.

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
