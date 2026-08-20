import { logout } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { GateActions, GateBody, GateHeading, GateShell } from './GateShell';

export function NoAccessScreen() {
  return (
    <GateShell
      brand={
        <>
          <GateHeading>No access yet</GateHeading>
          <GateBody>
            Your account isn't linked to a profile in this app. Ask an admin to add you, or confirm you're using the
            right email.
          </GateBody>
        </>
      }
    >
      <p className="m-0 mb-6 text-center text-sm leading-relaxed text-text-muted">
        Once an admin adds you to the team, sign back in and you'll be able to vote.
      </p>
      <GateActions>
        <Button variant="ghost" className="w-full" onClick={() => logout()}>
          Log out
        </Button>
      </GateActions>
    </GateShell>
  );
}
