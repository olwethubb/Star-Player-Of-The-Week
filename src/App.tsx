import { useSession } from '@/hooks/useSession';
import { useRevealCeremony } from '@/hooks/useRevealCeremony';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/Spinner';
import { NamePicker } from '@/features/picker/NamePicker';
import { MainScreen } from '@/features/voting/MainScreen';
import { ResultsPage } from '@/features/reveal/ResultsPage';
import { RevealCeremony } from '@/features/reveal/RevealCeremony';

export function App() {
  const session = useSession();
  // resetKey: changes whenever this browser's identity changes (claiming or
  // releasing a name), so the reveal ceremony's replay guard doesn't carry state
  // across what's effectively a fresh session for this device.
  const ceremony = useRevealCeremony(session.settings.revealed, session.loadedSettings, session.myUid);

  // The picker renders OUTSIDE AppShell: it's a full-bleed centred layout, and
  // AppShell's max-w-[820px] column would cage it.
  if (!session.myUid) {
    return <NamePicker />;
  }

  const loaded = session.loadedProfiles && session.loadedClaims && session.loadedSettings && session.loadedVoters;
  if (!loaded || !session.me) {
    return (
      <AppShell>
        <Spinner label="Loading the vote" errorMsg={session.loadErrorMsg} />
      </AppShell>
    );
  }

  if (ceremony.pending && ceremony.phase) {
    return (
      <AppShell>
        <RevealCeremony
          phase={ceremony.phase}
          spinMs={ceremony.spinMs}
          settings={session.settings}
          profiles={session.profiles}
        />
      </AppShell>
    );
  }

  return <AppShell>{session.settings.revealed ? <ResultsPage /> : <MainScreen />}</AppShell>;
}
