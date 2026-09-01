import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/lib/errors';
import { getWeekLabel } from '@/lib/week';
import { addTeammate } from '@/services/profiles.service';
import { HOST_NAME, isHostName } from '@/types/firestore';
import { PickerBody, PickerEyebrow, PickerHeading, PickerShell } from './PickerShell';

/** A brand-new project has no roster and no host — nobody can claim a name that
 * doesn't exist yet, and normally only the host can add one. firestore.rules opens a
 * narrow one-time exception for exactly this: before any host is registered, anyone
 * may create ONLY a profile shaped `{ name: 'KG' }`. This button is that exception's
 * one and only call site — claiming it immediately after registers the claimer as
 * host (see claimName in SessionProvider), which closes the exception for good. */
function BootstrapFirstRun() {
  const { claimName } = useSession();
  const [starting, setStarting] = useState(false);
  const { notify } = useToast();

  async function start() {
    setStarting(true);
    try {
      const ref = await addTeammate(HOST_NAME);
      await claimName(ref.id);
    } catch (err) {
      notify(friendlyError(err, 'Could not set up the team. Try again in a moment.'));
      setStarting(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
      <p className="m-0 mb-4 text-[13px] leading-relaxed text-text-muted">
        Nobody's on the roster yet. The first thing this app needs is someone to run it — that's {HOST_NAME}.
      </p>
      <Button variant="ghost" disabled={starting} onClick={start}>
        {starting ? 'Setting up…' : `I'll be ${HOST_NAME} and add the team`}
      </Button>
    </div>
  );
}

/** Replaces the entire sign-in flow: no email, no PIN, no password. You tap your
 * name and you're in.
 *
 * A name can only be taken once — the first browser to claim it owns it, and it
 * shows as taken to everyone else from then on. That's enforced by firestore.rules
 * (the claim doc is create-only), not just greyed out here, so nobody can vote as
 * someone who's already claimed by tapping past the UI. */
export function NamePicker() {
  const { profiles, claims, loadedProfiles, loadedClaims, claimName, loadErrorMsg } = useSession();
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const { notify } = useToast();

  async function pick(uid: string) {
    setPendingUid(uid);
    try {
      await claimName(uid);
    } catch (err) {
      notify(friendlyError(err, 'Could not take that name. Try again in a moment.'));
    } finally {
      setPendingUid(null);
    }
  }

  if (!loadedProfiles || !loadedClaims) {
    return (
      <PickerShell>
        <Spinner label="Loading the team" errorMsg={loadErrorMsg} />
      </PickerShell>
    );
  }

  const rows = Object.entries(profiles).sort((a, b) => a[1].name.localeCompare(b[1].name));

  return (
    <PickerShell
      brand={
        <>
          <PickerEyebrow>{getWeekLabel()}</PickerEyebrow>
          <PickerHeading>Star Player of the Week</PickerHeading>
          <PickerBody>Vote for the teammate who went above and beyond this week.</PickerBody>
        </>
      }
    >
      <p className="m-0 mb-1.5 text-center font-display text-lg font-bold text-text">Who are you?</p>
      <p className="m-0 mb-6 text-center text-sm leading-relaxed text-text-muted">
        Tap your name to start voting. Once you pick it, it's yours — nobody else can vote as you.
      </p>

      {rows.length === 0 ? (
        <BootstrapFirstRun />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map(([uid, profile]) => {
            const taken = !!claims[uid];
            const busy = pendingUid === uid;
            return (
              <li key={uid}>
                <button
                  type="button"
                  disabled={taken || !!pendingUid}
                  onClick={() => pick(uid)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-[transform,border-color] ${
                    taken
                      ? 'cursor-not-allowed border-border-soft bg-transparent opacity-45'
                      : 'cursor-pointer border-border bg-bg-card hover:-translate-y-0.5 hover:border-accent disabled:cursor-wait'
                  }`}
                >
                  <Avatar name={profile.name} avatarUrl={profile.avatarUrl} size="sm" />
                  <span className="min-w-0 flex-1 font-display text-[15px] font-semibold [overflow-wrap:anywhere]">
                    {profile.name}
                    {isHostName(profile.name) && (
                      <span className="ml-1.5 font-mono text-[10px] font-normal uppercase tracking-[0.08em] text-text-muted">
                        runs the reveal
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted">
                    {busy ? 'Taking…' : taken ? 'Taken' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="m-0 mt-6 border-t border-border-soft pt-5 text-center text-xs leading-relaxed text-text-muted">
        Name already taken but it's actually you? Ask KG to free it up — that happens if you've cleared your browser
        or switched phones.
      </p>
    </PickerShell>
  );
}
