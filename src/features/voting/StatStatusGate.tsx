import { Button } from '@/components/ui/Button';
import { declareMyStatus } from '@/services/statStatus.service';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/lib/errors';
import type { StatLevel } from '@/types/firestore';

/** Gates the vote grid: everyone (except KG, who's never shown this — see MainScreen)
 * has to say whether their stats are up or down for the week before they can see or
 * cast a vote. 'Down' just means nobody can vote for THEM this week — they can still
 * vote for someone who's up. */
export function StatStatusGate({ uid, current }: { uid: string; current: StatLevel | null }) {
  const { notify } = useToast();

  function pick(status: StatLevel) {
    declareMyStatus(uid, status).catch((err) =>
      notify(friendlyError(err, 'Could not save that. Try again in a moment.')),
    );
  }

  // Once declared, both options stay on screen as a toggle rather than collapsing to a
  // summary with a small "Change" link — that link was easy to miss on a phone, and
  // people took a "Stats Down" they'd tapped by mistake as locked in.
  if (current) {
    const option = (status: StatLevel, label: string) => (
      <button
        type="button"
        aria-pressed={current === status}
        onClick={() => current !== status && pick(status)}
        className={`min-h-11 flex-1 cursor-pointer rounded-full border px-4 text-[13px] font-semibold transition-colors ${
          current === status
            ? 'border-accent bg-accent text-accent-contrast'
            : 'border-border bg-transparent text-text hover:border-accent hover:text-accent'
        }`}
      >
        {label}
      </button>
    );
    return (
      <div className="mb-5 rounded-xl border border-border-soft bg-bg-elevated px-4 py-3">
        <p className="m-0 mb-2.5 text-[13px] text-text-muted">
          Your stats this week — tap to change
          {current === 'down' &&
            ". On \"Down\" you're off the poll and any votes you'd already received don't count — but you can still vote."}
        </p>
        <div className="flex gap-2" role="group" aria-label="Your stats this week">
          {option('up', 'Stats Up')}
          {option('down', 'Stats Down')}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-2xl border border-border bg-bg-card p-4 shadow-card">
      <p className="m-0 mb-1.5 font-display text-[15px] font-semibold">Are your stats up or down this week?</p>
      <p className="m-0 mb-3.5 text-[13px] leading-relaxed text-text-muted">
        Pick one before you can vote. Only "up" appears on the poll — pick "down" and you just won't be on it
        yourself, you can still vote for someone else.
      </p>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => pick('up')}>
          Stats Up
        </Button>
        <Button variant="ghost" className="flex-1" onClick={() => pick('down')}>
          Stats Down
        </Button>
      </div>
    </div>
  );
}
