import { useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { useRevealCeremony } from '@/hooks/useRevealCeremony';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/Spinner';
import { Gate } from '@/features/gate/Gate';
import { LoginForm } from '@/features/gate/LoginForm';
import { SignupForm } from '@/features/gate/SignupForm';
import { VerifyEmailScreen } from '@/features/gate/VerifyEmailScreen';
import { NoAccessScreen } from '@/features/gate/NoAccessScreen';
import { MainScreen } from '@/features/voting/MainScreen';
import { ResultsPage } from '@/features/reveal/ResultsPage';
import { RevealCeremony } from '@/features/reveal/RevealCeremony';

type GateMode = 'gate' | 'login' | 'signup';

export function App() {
  const session = useSession();
  const [gateMode, setGateMode] = useState<GateMode>('gate');
  const ceremony = useRevealCeremony(session.settings.revealed, session.loadedSettings, session.authEpoch);

  if (session.authResolving) {
    return (
      <AppShell>
        <Spinner />
      </AppShell>
    );
  }

  if (!session.user) {
    return (
      <AppShell>
        {gateMode === 'login' && <LoginForm onSignup={() => setGateMode('signup')} onBack={() => setGateMode('gate')} />}
        {gateMode === 'signup' && <SignupForm onLogin={() => setGateMode('login')} onBack={() => setGateMode('gate')} />}
        {gateMode === 'gate' && <Gate onVote={() => setGateMode('login')} onSignup={() => setGateMode('signup')} />}
      </AppShell>
    );
  }

  const loaded = session.loadedProfiles && session.loadedSettings && session.loadedMyVote && session.loadedMyBalance;
  if (!loaded) {
    return (
      <AppShell>
        <Spinner errorMsg={session.loadErrorMsg} />
      </AppShell>
    );
  }

  if (!session.me) {
    return (
      <AppShell>
        <NoAccessScreen />
      </AppShell>
    );
  }

  if (session.me.selfSignup && !session.user.emailVerified) {
    return (
      <AppShell>
        <VerifyEmailScreen user={session.user} onRefresh={session.refreshUser} />
      </AppShell>
    );
  }

  if (ceremony.pending && ceremony.phase) {
    return (
      <AppShell>
        <RevealCeremony phase={ceremony.phase} count={ceremony.count} settings={session.settings} profiles={session.profiles} />
      </AppShell>
    );
  }

  if (session.settings.revealed && session.isAdmin && !session.loadedTally) {
    return (
      <AppShell>
        <Spinner />
      </AppShell>
    );
  }

  return <AppShell>{session.settings.revealed ? <ResultsPage /> : <MainScreen />}</AppShell>;
}
