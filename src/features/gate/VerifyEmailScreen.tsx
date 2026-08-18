import { auth } from '@/lib/firebase';
import { logout, resendVerificationEmail } from '@/services/auth.service';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/Button';
import { GateActions, GateBody, GateHeading, GateLink, GateLogo, GateShell } from './GateShell';
import type { User } from 'firebase/auth';

export function VerifyEmailScreen({ user, onRefresh }: { user: User; onRefresh: () => Promise<void> }) {
  const { notify } = useToast();

  function handleRefresh() {
    onRefresh().then(() => {
      if (!auth.currentUser?.emailVerified) {
        notify("Still not verified — check your email and try again once you've clicked the link.");
      }
    });
  }

  function handleResend() {
    if (!auth.currentUser) return;
    resendVerificationEmail(auth.currentUser)
      .then(() => notify('Verification email sent — check your inbox.', 'success'))
      .catch(() => notify('Could not send the email right now. Try again in a moment.'));
  }

  return (
    <GateShell>
      <GateLogo />
      <GateHeading>Verify your email</GateHeading>
      <GateBody>
        We sent a link to <strong className="text-text">{user.email}</strong>. Click it, then come back here and
        continue.
      </GateBody>
      <GateActions>
        <Button variant="gate" onClick={handleRefresh}>
          I've verified — continue
        </Button>
        <Button variant="ghost" onClick={handleResend}>
          Resend email
        </Button>
      </GateActions>
      <GateLink onClick={() => logout()}>Log out</GateLink>
    </GateShell>
  );
}
