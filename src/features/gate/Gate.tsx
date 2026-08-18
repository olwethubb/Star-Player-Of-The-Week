import { getWeekLabel } from '@/lib/week';
import { BONUS_AMOUNT } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { GateActions, GateBody, GateEyebrow, GateHeading, GateLink, GateLogo, GateShell } from './GateShell';

export function Gate({ onVote, onSignup }: { onVote: () => void; onSignup: () => void }) {
  return (
    <GateShell>
      <GateLogo />
      <GateEyebrow>{getWeekLabel()}</GateEyebrow>
      <GateHeading>Star Worker of the Week</GateHeading>
      <GateBody>
        Vote for the teammate who went above and beyond this week. The winner takes home B${BONUS_AMOUNT} in
        Blacfox Dollars.
      </GateBody>
      <GateActions>
        <Button variant="gate" onClick={onVote}>
          Vote Now
        </Button>
      </GateActions>
      <GateLink onClick={onSignup}>New here? Create an account</GateLink>
    </GateShell>
  );
}
