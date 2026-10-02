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
stuck on the browser that claimed it — a revealer (see below) frees it from
**Team → Free up name**, then you can take it again.

**Home — one vote per device.** Signed-in screens have a **Home** button
(it replaced "Not you?") that signs you out back to the name picker. Going
Home takes back the vote *this device* cast, then clears the name's
stats-up/down choice — except a Stats Down choice, which stays so that
leaving can't undo Down. Votes other people gave you live on your own count
and still count at the reveal. So everyone votes on their own phone: a
shared phone can't stack votes, because each hand-over undoes the previous
person's vote. And if the server already has a vote from you this round but
this device doesn't know who for (your sign-in expired, or site data was
cleared), the app tells you your vote is in rather than letting you vote
twice. See `retractVote` in `src/services/voting.service.ts`, `releaseName`
in `src/context/SessionProvider.tsx` and `votedWithoutPick` in
`MainScreen.tsx`.

**Switching to Stats Down takes your votes away.** You drop off the poll
straight away, and at the reveal everyone's received votes count except a
Down person's, so they end on 0 however many votes they'd picked up. Going
Home or an expired sign-in never does that. Anyone who'd voted for them sees
"Your vote for X doesn't count any more" and can vote again. Votes are never
deleted mid-round, just not counted, so if X flips back to Up before the
reveal, votes from anyone who didn't change their pick count again. See
`countableTally` in `src/lib/roundRules.ts` and `stalePick` in
`MainScreen.tsx`.

**Everything resets after every reveal.** The reveal saves the result
(winner, total votes) and the streak history, and in the same write wipes
every count, every "I voted" marker and everyone's stats choice, so the next
round starts from zero.

**A claim nobody's refreshed in 15 minutes frees itself, too.** Claiming a
name has no expiry on its own — closing a tab doesn't release it — so every
open, claimed browser quietly "proves it's still there" every 30 seconds by
refreshing a `lastSeenAt` heartbeat on its own claim (`touchClaim` in
`src/services/claims.service.ts`). Every open tab, not just a revealer's,
also checks every 30 seconds for any claim that's gone quiet longer than
`CLAIM_STALE_AFTER_MS` (15 minutes — see `src/lib/constants.ts`) and frees
it automatically (`releaseStaleClaims`). This is what keeps "N people have
voted so far" honest: without it, a name claimed once and then abandoned —
tab closed, phone put away — would count as "signed in" forever. Three
guards keep it from signing out anyone who's really there (all in
`findStaleClaimUids`, `src/lib/roundRules.ts`, unit-tested): anyone Up this
round is never swept, so a locked phone can't drop a candidate off the poll;
a heartbeat still being written counts as fresh; and staleness is measured
against the newest server heartbeat as well as the device clock, so one
device with a wrong clock can't sign everyone out. It only frees the claim,
never the stats choice. The "N" in turnout counts people signed in now plus
anyone who already voted (`roundParticipantCount`), so it can't read
"everyone's voted" just because voters' sign-ins expired.

**KG, Steph, or OB can reveal the winner — same trade.** Whoever's browser
has claimed one of those three names sees the session controls — see
`REVEALER_NAMES` in `src/types/firestore.ts`. Voting starts every week
**locked**: everyone signed in, revealer included, sees a "voting hasn't
started" screen instead of the vote grid, until one of the three taps
**Start Voting**. From there, tapping **Reveal Winner** closes voting and
works out the winner in the same action — nothing here is automatic, it's on
whoever taps it to have actually checked, by asking around the office, that
everyone's voted first. Unlike an earlier version of this app, a revealer
votes exactly like anyone else — declares stats, shows up in the grid, casts
a pick — this only ever gates the session controls and the Team panel (so
the roster can be edited without waiting on any one specific person).
Separately, and regardless of who can currently reveal, KG specifically is
never a candidate at all — never asked to declare stats, never on anyone's
grid — because KG is the CEO, not because of anything to do with revealing.
The app's UI decides all of this purely by checking which names are
currently claimed, so the roster **needs a profile called KG, Steph, or OB**
or nobody sees those controls at all — and, same as above, the database
doesn't verify who's allowed to be the one who claimed it. Whoever it
applies to sees a plain banner on their own screen saying so, so a Steph or
OB isn't left wondering why they have extra controls. The name picker itself
only marks **KG** and **Steph** with a small star, on purpose — OB's ability
to reveal is deliberately not advertised there, so nobody glancing at that
list can tell OB has it too. It's cosmetic only: OB has every bit of the
real power once claimed, just without the public tag — see
`PUBLIC_REVEALER_NAMES` in `src/types/firestore.ts`.

**Reveal Winner needs at least one vote.** Until the first vote lands, the
button isn't there at all — a short note sits in its place.

**A tie is never broken — everyone tied wins.** There's no runoff or re-vote.
The wheel spins as normal, then cracks apart and breaks away, and every tied
name is revealed together as a Star Player of the Week — two, three, six,
however many (see `Wheel.tsx` and `joinNames` in `src/lib/winners.ts`).

**Reset Voting, any time.** A revealer doesn't need to reveal anything to
start a round over — the **Reset Voting** button clears every vote cast so
far this round and locks voting again, with its own confirm step since it's
destructive. A fresh Start Voting tap is needed afterward, same as any other
locked start. Same underlying action ("Start a new vote") already existed
for after a reveal, on the results page; this is the same escape hatch made
available mid-session too — see `startNewRound` in
`src/services/voting.service.ts`.

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
open (not just by a revealer — the rule doesn't check who's asking, only
whether voting is closed), because watching a live count move is itself a
way to infer who just voted for whom, no matter who's watching.

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
