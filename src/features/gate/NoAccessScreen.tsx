import { logout } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { GateActions, GateBody, GateHeading, GateLogo, GateShell } from './GateShell';

export function NoAccessScreen() {
  return (
    <GateShell>
      <GateLogo />
      <GateHeading>No access yet</GateHeading>
      <GateBody>
        Your account isn't linked to a profile in this app. Ask an admin to add you, or confirm you're using the
        right email.
      </GateBody>
      <GateActions>
        <Button variant="ghost" onClick={() => logout()}>
          Log out
        </Button>
      </GateActions>
    </GateShell>
  );
}
