# Blacfox — Star Worker of the Week

React + TypeScript + Vite app, backed by the existing Firebase project
(`star-player-of-the-week`) — Auth, Firestore, and `firestore.rules` are
unchanged from the previous version of this app.

## Setup

```bash
npm install
cp .env.example .env.local   # already pre-filled with the real (public) Firebase config below if present
npm run dev
```

The `.env.local` values are the same public Firebase web config (`apiKey`,
`authDomain`, etc.) the old `legacy/index.html` had hardcoded — not secrets,
just moved out of source per normal practice. If you're setting this up
fresh, copy them from Firebase console → Project settings → General → Your
apps → SDK setup and configuration.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run typecheck` | `tsc -b`, no emit to `dist/` |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm test` | Vitest unit tests (pure logic — week math, winner computation, error mapping) |
| `npm run test:rules` | Firestore Rules Emulator tests — spins up a local emulator and checks the actual `firestore.rules` invariants (self-vote rejected, tally admin-only, etc.). Needs Java (the emulator runs on it) and no other process on port 8080. |
| `npm run e2e` | Playwright smoke test against a running dev server |

## Deploying

This repo is wired for Firebase Hosting but **has not been deployed yet** —
that needs your own Firebase login, which an agent session can't complete
(it's an interactive OAuth flow):

```bash
firebase login
npm run build
firebase deploy --only hosting
```

Always pass `--only hosting`. `firestore.rules` is intentionally frozen —
never let a hosting deploy touch it.

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
"winner" invented when zero real votes were cast, and an admin control to
manually override which calendar week it "is". Both are replaced by the test
suite above — see `src/rules/firestore.rules.test.ts` and
`src/lib/week.test.ts` if you need to exercise similar scenarios locally.
