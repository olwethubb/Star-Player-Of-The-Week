import { auth } from '@/lib/firebase';
import { logout, resendVerificationEmail } from '@/services/auth.service';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/Button';
import { GateActions, GateBody, GateHeading, GateLink, GateLinks, GateShell } from './GateShell';
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
    <GateShell
      brand={
        <>
          <GateHeading>Verify your email</GateHeading>
          <GateBody>
            We sent a link to <strong className="font-semibold text-on-dark">{user.email}</strong>. Click it, then come
            back here and continue.
          </GateBody>
        </>
      }
    >
      <p className="m-0 mb-6 text-sm leading-relaxed text-text-muted">
        Already clicked the link? Continue below and we'll re-check.
      </p>
      <GateActions>
        <Button variant="gate" onClick={handleRefresh}>
          I've verified — continue
        </Button>
        <Button variant="ghost" className="w-full" onClick={handleResend}>
          Resend email
        </Button>
      </GateActions>
      <GateLinks>
        <GateLink subtle onClick={() => logout()}>
          Log out
        </GateLink>
      </GateLinks>
    </GateShell>
  );
}
