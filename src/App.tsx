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
  const ceremony = useRevealCeremony(session.settings.revealed, session.loadedSettings, session.authEpoch);

  // Anonymous sign-in is still resolving. We genuinely don't know yet whether this
  // browser already holds a name, so show neutral loading rather than the picker —
  // someone who chose weeks ago would otherwise flash it on every load.
  if (session.authResolving) {
    return (
      <AppShell>
        <Spinner label="Getting things ready" errorMsg={session.loadErrorMsg} />
      </AppShell>
    );
  }

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
