import { Button } from '@/components/ui/Button';
import { declareMyStatus } from '@/services/statStatus.service';
import { useToast } from '@/hooks/useToast';
import { friendlyError } from '@/lib/errors';
import type { StatLevel } from '@/types/firestore';

/** Gates the vote grid: everyone has to say whether their stats are up or down
 * for the week before they can see or cast a vote. 'Down' just means nobody can
 * vote for THEM this week — they can still vote for someone who's up. */
export function StatStatusGate({ uid, current }: { uid: string; current: StatLevel | null }) {
  const { notify } = useToast();

  function pick(status: StatLevel) {
    declareMyStatus(uid, status).catch((err) =>
      notify(friendlyError(err, 'Could not save that. Try again in a moment.')),
    );
  }

  if (current) {
    return (
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-border-soft bg-bg-elevated px-4 py-3 text-[13px]">
        <span className="text-text-muted">
          This week you're marked <b className="text-text">{current === 'up' ? 'Stats Up' : 'Stats Down'}</b>
          {current === 'down' && ' — you won\'t appear on the poll, but you can still vote'}
        </span>
        <button
          type="button"
          className="ml-auto cursor-pointer border-none bg-transparent p-0 text-[12px] text-text-muted underline decoration-border underline-offset-[3px] hover:text-accent hover:decoration-accent"
          onClick={() => pick(current === 'up' ? 'down' : 'up')}
        >
          Change
        </button>
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
