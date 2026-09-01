import { useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { Button } from '@/components/ui/Button';
import { IconCheck, IconChevronDown } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/Spinner';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/lib/errors';
import { getWeekLabel } from '@/lib/week';
import { addTeammate } from '@/services/profiles.service';
import { HOST_NAME, isHostName, type Profile } from '@/types/firestore';
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

/** A dropdown built from Radix's unstyled Select primitive instead of a native
 * `<select>`. The native element's closed box can be themed, but the OPEN popup is
 * rendered by the browser's own OS chrome — flat white, system font, a boring grey
 * highlight — no CSS reaches it. Radix's version renders its popup as a normal
 * portaled DOM node this app fully controls, so it can actually look like the rest
 * of the app instead of a jarring, unstyled system dialog dropped on top of it. */
function NameSelect({
  available,
  value,
  onChange,
}: {
  available: [string, Profile][];
  value: string;
  onChange: (uid: string) => void;
}) {
  const selectedName = available.find(([uid]) => uid === value)?.[1]?.name;

  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="flex min-h-12 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-border bg-bg-elevated px-3.5 text-base text-text outline-none transition-colors data-[placeholder]:text-text-muted data-[state=open]:border-accent">
        <Select.Value placeholder="Select your name">{selectedName}</Select.Value>
        <Select.Icon className="text-text-muted">
          <IconChevronDown />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        {/* bg-on-dark-surface etc., not bg-bg-card/text-text: this content portals
            straight to document.body, outside the DOM subtree PickerShell's
            .gate-glass-card scopes those tokens within. Root-level on-dark-surface
            resolves correctly regardless — see tokens.css. */}
        <Select.Content
          position="popper"
          sideOffset={8}
          className="z-[100] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-on-dark-surface-border bg-on-dark-surface shadow-[0_20px_44px_-12px_rgba(0,0,0,0.6)] data-[state=open]:animate-fadein"
        >
          <Select.ScrollUpButton className="flex h-6 cursor-default items-center justify-center bg-on-dark-surface text-on-dark-muted">
            <IconChevronDown className="rotate-180" />
          </Select.ScrollUpButton>
          <Select.Viewport className="max-h-[min(320px,60vh)] p-1.5">
            {available.map(([uid, profile]) => (
              <Select.Item
                key={uid}
                value={uid}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-[15px] text-on-dark outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-contrast"
              >
                <Select.ItemText>{profile.name}</Select.ItemText>
                <span className="flex items-center gap-2">
                  {isHostName(profile.name) && (
                    <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.06em] opacity-70">
                      runs the reveal
                    </span>
                  )}
                  <Select.ItemIndicator>
                    <IconCheck />
                  </Select.ItemIndicator>
                </span>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="flex h-6 cursor-default items-center justify-center bg-on-dark-surface text-on-dark-muted">
            <IconChevronDown />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
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
          <NameSelect available={available} value={selected} onChange={setSelected} />
          <Button variant="gate" className="w-auto sm:w-[140px]" disabled={!selected || joining} onClick={join}>
            {joining ? 'Joining…' : 'Join'}
          </Button>
        </div>
      )}
    </PickerShell>
  );
}
