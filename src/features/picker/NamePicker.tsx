import { useState } from 'react';
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

/** Replaces the entire sign-in flow: no email, no PIN, no password. Pick your name
 * from the dropdown and you're in.
 *
 * Only names nobody has claimed yet show up as options — once someone's picked a
 * name, it drops out of the list here for everyone else, rather than staying visible
 * as a disabled row. That's cosmetic, not the actual guard: firestore.rules is what
 * stops the claim doc itself from being taken twice. */
export function NamePicker() {
  const { profiles, claims, loadedProfiles, loadedClaims, claimName, loadErrorMsg } = useSession();
  const [selected, setSelected] = useState('');
  const [joining, setJoining] = useState(false);
  const { notify } = useToast();

  async function join() {
    if (!selected) return;
    setJoining(true);
    try {
      await claimName(selected);
    } catch (err) {
      notify(friendlyError(err, 'Could not take that name. Try again in a moment.'));
      setJoining(false);
    }
  }

  if (!loadedProfiles || !loadedClaims) {
    return (
      <PickerShell>
        <Spinner label="Loading the team" errorMsg={loadErrorMsg} />
      </PickerShell>
    );
  }

  const available = Object.entries(profiles)
    .filter(([uid]) => !claims[uid])
    .sort((a, b) => a[1].name.localeCompare(b[1].name));

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
      <p className="m-0 mb-6 text-center font-display text-lg font-bold text-text">Who are you?</p>

      {Object.keys(profiles).length === 0 ? (
        <BootstrapFirstRun />
      ) : available.length === 0 ? (
        <p className="m-0 rounded-xl border border-dashed border-border px-4 py-6 text-center text-[13px] leading-relaxed text-text-muted">
          Everyone's already picked a name. Ask {HOST_NAME} to free yours up if that's not you.
        </p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-border bg-bg-elevated px-3.5 text-base text-text focus:border-accent focus:outline-none"
          >
            {/* The closed box sits on the picker's dark glass card, so it needs the
                light "on dark" text this scope provides via text-text above. The
                OPEN dropdown list is a different story: browsers render that popup
                with their own (usually white) chrome and ignore a custom background
                on it, while still applying whatever text color we set — so light
                text here would be near-invisible on a white popup. These options
                get a color that doesn't depend on the dark-card scope at all,
                matching the app's normal (light-background) theme instead, because
                that's the reality of what actually renders. */}
            <option value="" disabled style={{ color: '#201a14', backgroundColor: '#ffffff' }}>
              Select your name
            </option>
            {available.map(([uid, profile]) => (
              <option key={uid} value={uid} style={{ color: '#201a14', backgroundColor: '#ffffff' }}>
                {profile.name}
                {isHostName(profile.name) ? ' — runs the reveal' : ''}
              </option>
            ))}
          </select>
          <Button variant="gate" className="w-auto sm:w-[140px]" disabled={!selected || joining} onClick={join}>
            {joining ? 'Joining…' : 'Join'}
          </Button>
        </div>
      )}
    </PickerShell>
  );
}
