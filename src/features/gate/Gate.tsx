import { getWeekLabel } from '@/lib/week';
import { BONUS_AMOUNT } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { GateActions, GateBody, GateEyebrow, GateHeading, GateLink, GateLinks, GateShell } from './GateShell';

export function Gate({ onVote, onSignup }: { onVote: () => void; onSignup: () => void }) {
  return (
    <GateShell
      brand={
        <>
          <GateEyebrow>{getWeekLabel()}</GateEyebrow>
          <GateHeading>Star Player of the Week</GateHeading>
          <GateBody>
            Vote for the teammate who went above and beyond this week. The winner takes home B${BONUS_AMOUNT} in
            Blacfox Dollars.
          </GateBody>
        </>
      }
    >
      <p className="m-0 mb-1.5 text-center font-display text-lg font-bold text-text">Ready to vote?</p>
      <p className="m-0 mb-6 text-center text-sm leading-relaxed text-text-muted">
        Sign in with your Blacfox email to cast this week's vote.
      </p>
      <GateActions>
        <Button variant="gate" onClick={onVote}>
          Vote Now
        </Button>
      </GateActions>
      <GateLinks>
        <GateLink onClick={onSignup}>New here? Create an account</GateLink>
      </GateLinks>
    </GateShell>
  );
}
